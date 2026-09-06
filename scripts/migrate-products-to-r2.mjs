// Перенос картинок товаров из Dropbox в Cloudflare R2.
//
// Зачем: у Dropbox ссылка на файл временная, поэтому на каждую картинку
// каталога нужен запрос к их API — и он стоит на критическом пути отрисовки.
// В R2 адрес постоянный, браузер идёт за картинкой сразу.
//
// Переносятся только товары с путём вида '/products/...'. Статика из
// public/ (magnets/01.avif и т.п.) не трогается: она и так отдаётся с CDN
// Vercel и никуда ходить не надо.
//
// По умолчанию только показывает, что будет сделано:
//   node --env-file=.env.local scripts/migrate-products-to-r2.mjs
// Выполнить перенос:
//   node --env-file=.env.local scripts/migrate-products-to-r2.mjs --apply
//
// Скрипт идемпотентен: уже перенесённые товары пропускаются, файл в Dropbox
// остаётся на месте — откат это просто возврат старого значения в базе.
import { PrismaClient } from '@prisma/client';
import { createHash, createHmac } from 'node:crypto';

const APPLY = process.argv.includes('--apply');

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  DROPBOX_REFRESH_TOKEN,
  DROPBOX_APP_KEY,
  DROPBOX_APP_SECRET,
} = process.env;

for (const [name, value] of Object.entries({
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  DROPBOX_REFRESH_TOKEN,
  DROPBOX_APP_KEY,
  DROPBOX_APP_SECRET,
})) {
  if (!value) {
    console.error(`Не задана переменная ${name} — запускайте с --env-file=.env.local`);
    process.exit(1);
  }
}

const ENDPOINT = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const prisma = new PrismaClient();

// ---------------------------------------------------------------- Dropbox

let dropboxToken = null;
async function getDropboxToken() {
  if (dropboxToken) return dropboxToken;
  const auth = Buffer.from(`${DROPBOX_APP_KEY}:${DROPBOX_APP_SECRET}`).toString('base64');
  const res = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: DROPBOX_REFRESH_TOKEN,
    }),
  });
  if (!res.ok) throw new Error(`Dropbox auth ${res.status}: ${await res.text()}`);
  dropboxToken = (await res.json()).access_token;
  return dropboxToken;
}

async function downloadFromDropbox(path) {
  const token = await getDropboxToken();
  const res = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ path }),
    },
  });
  if (!res.ok) {
    throw new Error(`скачивание ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ---------------------------------------------------------------- R2

const sha256hex = (d) => createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => createHmac('sha256', k).update(d).digest();

function contentTypeFor(key) {
  const ext = key.toLowerCase().split('.').pop();
  return (
    {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      avif: 'image/avif',
      gif: 'image/gif',
      svg: 'image/svg+xml',
    }[ext] || 'application/octet-stream'
  );
}

async function putToR2(key, body) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const uri = '/' + R2_BUCKET + '/' + key.split('/').map(encodeURIComponent).join('/');
  const hash = sha256hex(body);
  const type = contentTypeFor(key);

  const headers = [
    ['content-type', type],
    ['host', ENDPOINT],
    ['x-amz-content-sha256', hash],
    ['x-amz-date', amzDate],
  ];
  const signed = headers.map(([k]) => k).join(';');
  const canonical = [
    'PUT',
    uri,
    '',
    headers.map(([k, v]) => `${k}:${v}\n`).join(''),
    signed,
    hash,
  ].join('\n');
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonical)].join('\n');

  let k = hmac(`AWS4${R2_SECRET_ACCESS_KEY}`, dateStamp);
  k = hmac(k, 'auto');
  k = hmac(k, 's3');
  k = hmac(k, 'aws4_request');
  const signature = hmac(k, toSign).toString('hex');

  const res = await fetch(`https://${ENDPOINT}${uri}`, {
    method: 'PUT',
    headers: {
      'content-type': type,
      'x-amz-content-sha256': hash,
      'x-amz-date': amzDate,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, ` +
        `SignedHeaders=${signed}, Signature=${signature}`,
    },
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    throw new Error(`R2 PUT ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------- перенос

const kb = (n) => (n / 1024).toFixed(0) + ' КБ';

// '/products/1712_foo.jpg' -> 'products/1712_foo.jpg'
const keyFor = (path) => path.replace(/^\/+/, '');

const products = await prisma.product.findMany({ orderBy: { number: 'asc' } });
const pending = products.filter((p) => p.image?.startsWith('/products/'));
const already = products.filter((p) => p.image?.startsWith('r2:')).length;

console.log(`Товаров всего:        ${products.length}`);
console.log(`Уже в R2:             ${already}`);
console.log(`К переносу:           ${pending.length}`);
console.log(`Статика в репозитории: ${products.length - pending.length - already}`);

if (!pending.length) {
  console.log('\nПереносить нечего.');
  await prisma.$disconnect();
  process.exit(0);
}

if (!APPLY) {
  console.log('\nЭто просмотр. Будет перенесено:');
  for (const p of pending) {
    console.log(`  №${String(p.number).padEnd(8)} ${p.image}`);
  }
  console.log('\nЧтобы выполнить, добавьте --apply');
  await prisma.$disconnect();
  process.exit(0);
}

console.log('\nПереношу...');
let done = 0;
let failed = 0;
let bytes = 0;

for (const p of pending) {
  const key = keyFor(p.image);
  try {
    const body = await downloadFromDropbox(p.image);
    await putToR2(key, body);
    await prisma.product.update({
      where: { id: p.id },
      data: { image: `r2:${key}` },
    });
    bytes += body.length;
    done++;
    console.log(`  ok  №${String(p.number).padEnd(8)} ${kb(body.length).padStart(9)}  ${key}`);
  } catch (e) {
    failed++;
    console.error(`  СБОЙ №${p.number} ${p.image} — ${e.message}`);
  }
}

console.log(`\nПеренесено: ${done}, сбоев: ${failed}, объём: ${(bytes / 1048576).toFixed(2)} МБ`);
console.log('Файлы в Dropbox оставлены на месте — удалять их можно только после проверки.');

await prisma.$disconnect();

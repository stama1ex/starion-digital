// Перенос AR-ассетов из Dropbox в Cloudflare R2.
//
// Идёт по всем оживлениям, качает каждый файл из Dropbox, кладёт в R2 под тем
// же путём и переписывает путь в базе на 'r2:...'. Работает по одному файлу и
// безопасен к повторному запуску: уже перенесённые (те, что с префиксом r2:)
// пропускаются, а путь в базе меняется только после успешной записи в R2.
//
// Запуск:
//   node --env-file=.env.local scripts/migrate-ar-to-r2.mjs           # показать план
//   node --env-file=.env.local scripts/migrate-ar-to-r2.mjs --apply   # выполнить
//
// Файлы в Dropbox не удаляются: если что-то пойдёт не так, достаточно вернуть
// прежние пути в базе.

import { PrismaClient } from '@prisma/client';
import { createHash, createHmac } from 'node:crypto';

const APPLY = process.argv.includes('--apply');

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  NEXT_PUBLIC_R2_PUBLIC_URL,
  DROPBOX_APP_KEY,
  DROPBOX_APP_SECRET,
  DROPBOX_REFRESH_TOKEN,
} = process.env;

for (const [name, value] of Object.entries({
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  NEXT_PUBLIC_R2_PUBLIC_URL,
})) {
  if (!value) {
    console.error(`Не задана переменная ${name}`);
    process.exit(1);
  }
}

const ENDPOINT = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const prisma = new PrismaClient();

// ---------------------------------------------------------------- Dropbox

let dropboxToken = null;
async function getDropboxToken() {
  if (dropboxToken) return dropboxToken;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: DROPBOX_REFRESH_TOKEN,
  });
  const auth = Buffer.from(`${DROPBOX_APP_KEY}:${DROPBOX_APP_SECRET}`).toString('base64');
  const res = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
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
  if (!res.ok) throw new Error(`скачивание ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------------------------------------------------------------- R2

const sha256hex = (d) => createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => createHmac('sha256', k).update(d).digest();

function contentTypeFor(key) {
  const ext = key.toLowerCase().split('.').pop();
  return (
    {
      mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
      glb: 'model/gltf-binary', mind: 'application/octet-stream',
      mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg',
    }[ext] || 'application/octet-stream'
  );
}

async function putToR2(key, body) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
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
    'PUT', uri, '',
    headers.map(([k, v]) => `${k}:${v}\n`).join(''),
    signed, hash,
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
  if (!res.ok) throw new Error(`R2 PUT ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// ---------------------------------------------------------------- перенос

const FIELDS = ['markerUrl', 'mindFileUrl', 'contentUrl', 'posterUrl', 'maskUrl', 'textureUrl'];
const mb = (n) => (n / (1024 * 1024)).toFixed(2) + ' МБ';

async function moveOne(path) {
  const buf = await downloadFromDropbox(path);
  const key = path.replace(/^\/+/, '');
  if (APPLY) await putToR2(key, buf);
  return { key, size: buf.length };
}

const experiences = await prisma.aRExperience.findMany({
  orderBy: { createdAt: 'asc' },
});

console.log(APPLY ? '=== ПЕРЕНОС ===' : '=== ПЛАН (запуск без --apply) ===');
let total = 0;
let moved = 0;
let failed = 0;

for (const exp of experiences) {
  const updates = {};
  console.log(`\n[${exp.slug}] ${exp.title}`);

  for (const field of FIELDS) {
    const path = exp[field];
    if (!path) continue;
    if (path.startsWith('r2:')) {
      console.log(`  ${field}: уже в R2`);
      continue;
    }
    try {
      const { key, size } = await moveOne(path);
      updates[field] = `r2:${key}`;
      total += size;
      moved++;
      console.log(`  ${field}: ${mb(size)} -> r2:${key}`);
    } catch (e) {
      failed++;
      console.log(`  ${field}: ОШИБКА ${e.message}`);
    }
  }

  // озвучки лежат JSON-массивом
  const tracks = Array.isArray(exp.audioTracks) ? exp.audioTracks : [];
  if (tracks.length) {
    const next = [];
    let changed = false;
    for (const t of tracks) {
      if (!t?.path || String(t.path).startsWith('r2:')) {
        next.push(t);
        continue;
      }
      try {
        const { key, size } = await moveOne(t.path);
        next.push({ ...t, path: `r2:${key}` });
        changed = true;
        total += size;
        moved++;
        console.log(`  озвучка ${t.lang}: ${mb(size)} -> r2:${key}`);
      } catch (e) {
        next.push(t);
        failed++;
        console.log(`  озвучка ${t.lang}: ОШИБКА ${e.message}`);
      }
    }
    if (changed) updates.audioTracks = next;
  }

  if (APPLY && Object.keys(updates).length) {
    await prisma.aRExperience.update({ where: { id: exp.id }, data: updates });
    console.log('  пути в базе обновлены');
  }
}

console.log(`\nИтого: файлов ${moved}, объём ${mb(total)}, ошибок ${failed}`);
if (!APPLY) console.log('Это был план. Для переноса добавьте --apply');
await prisma.$disconnect();

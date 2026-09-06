// Перенос 3D-заготовок (magnet.glb, plate.glb) из корня Dropbox в R2.
//
// Эти два файла запрашивались на каждый рендер каталога магнитов, тарелок и
// главной — двумя последовательными обращениями к API Dropbox. В R2 адрес
// постоянный, и запросов не остаётся вовсе.
//
//   node --env-file=.env.local scripts/migrate-models-to-r2.mjs
//   node --env-file=.env.local scripts/migrate-models-to-r2.mjs --apply
import { createHash, createHmac } from 'node:crypto';

const APPLY = process.argv.includes('--apply');
const FILES = ['magnet.glb', 'plate.glb'];
const DIR = 'models';

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  NEXT_PUBLIC_R2_PUBLIC_URL,
  DROPBOX_REFRESH_TOKEN,
  DROPBOX_APP_KEY,
  DROPBOX_APP_SECRET,
} = process.env;

const ENDPOINT = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const sha256hex = (d) => createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => createHmac('sha256', k).update(d).digest();

async function dropboxToken() {
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
  return (await res.json()).access_token;
}

async function download(token, path) {
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

async function putToR2(key, body) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const uri = '/' + R2_BUCKET + '/' + key.split('/').map(encodeURIComponent).join('/');
  const hash = sha256hex(body);
  const type = 'model/gltf-binary';

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

  const res = await fetch(`https://${ENDPOINT}${uri}`, {
    method: 'PUT',
    headers: {
      'content-type': type,
      'x-amz-content-sha256': hash,
      'x-amz-date': amzDate,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, ` +
        `SignedHeaders=${signed}, Signature=${hmac(k, toSign).toString('hex')}`,
    },
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    throw new Error(`R2 PUT ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

const mb = (n) => (n / 1048576).toFixed(2) + ' МБ';

if (!APPLY) {
  console.log('Это просмотр. Будет перенесено из корня Dropbox в R2:');
  for (const f of FILES) console.log(`  /${f}  ->  ${DIR}/${f}`);
  console.log('\nЧтобы выполнить, добавьте --apply');
  process.exit(0);
}

const token = await dropboxToken();
for (const f of FILES) {
  const body = await download(token, `/${f}`);
  await putToR2(`${DIR}/${f}`, body);
  const url = `${NEXT_PUBLIC_R2_PUBLIC_URL}/${DIR}/${f}`;
  const check = await fetch(url, { method: 'HEAD' });
  console.log(`  ${f.padEnd(12)} ${mb(body.length).padStart(9)}  отдаётся: ${check.status}`);
}
console.log('\nГотово. Файлы в Dropbox оставлены на месте.');

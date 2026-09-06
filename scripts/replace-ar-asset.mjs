// Заменяет файл контента у оживления на подготовленный локально (обычно
// сжатый) и переключает на него базу.
//
// Старый файл не удаляется: он остаётся в R2 под прежним ключом, а исходник —
// ещё и в Dropbox. Откатиться можно, вернув прежний путь в базе.
//
// Запуск:
//   node --env-file=.env.local scripts/replace-ar-asset.mjs <slug> <файл> [поле] [--apply]
//
// поле — contentUrl (по умолчанию), markerUrl, posterUrl, maskUrl, textureUrl

import { PrismaClient } from '@prisma/client';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

const args = process.argv.slice(2).filter((a) => a !== '--apply');
const [slug, filePath, field = 'contentUrl'] = args;
const APPLY = process.argv.includes('--apply');
const ALLOWED = ['contentUrl', 'markerUrl', 'posterUrl', 'maskUrl', 'textureUrl'];
if (!ALLOWED.includes(field)) {
  console.error('поле должно быть одним из: ' + ALLOWED.join(', '));
  process.exit(1);
}

if (!slug || !filePath) {
  console.error('нужно: <slug> <путь к файлу> [--apply]');
  process.exit(1);
}

const {
  R2_ACCOUNT_ID: ACC,
  R2_ACCESS_KEY_ID: AK,
  R2_SECRET_ACCESS_KEY: SK,
  R2_BUCKET: BUCKET,
} = process.env;
const HOST = `${ACC}.r2.cloudflarestorage.com`;

const sha = (d) => createHash('sha256').update(d).digest('hex');
const hm = (k, d) => createHmac('sha256', k).update(d).digest();

function typeFor(name) {
  const ext = name.toLowerCase().split('.').pop();
  return (
    {
      glb: 'model/gltf-binary', mp4: 'video/mp4', webm: 'video/webm',
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
      mp3: 'audio/mpeg', m4a: 'audio/mp4',
    }[ext] || 'application/octet-stream'
  );
}

async function put(key, body) {
  const amz = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amz.slice(0, 8);
  const uri = '/' + BUCKET + '/' + key.split('/').map(encodeURIComponent).join('/');
  const hash = sha(body);
  const type = typeFor(key);
  const hdrs = [
    ['content-type', type], ['host', HOST],
    ['x-amz-content-sha256', hash], ['x-amz-date', amz],
  ];
  const signed = hdrs.map(([k]) => k).join(';');
  const canon = ['PUT', uri, '', hdrs.map(([k, v]) => `${k}:${v}\n`).join(''), signed, hash].join('\n');
  const scope = `${day}/auto/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amz, scope, sha(canon)].join('\n');
  let k = hm(`AWS4${SK}`, day);
  for (const part of ['auto', 's3', 'aws4_request']) k = hm(k, part);
  const sig = hm(k, toSign).toString('hex');

  const res = await fetch(`https://${HOST}${uri}`, {
    method: 'PUT',
    headers: {
      'content-type': type, 'x-amz-content-sha256': hash, 'x-amz-date': amz,
      Authorization: `AWS4-HMAC-SHA256 Credential=${AK}/${scope}, SignedHeaders=${signed}, Signature=${sig}`,
    },
    body: new Uint8Array(body),
  });
  if (!res.ok) throw new Error(`R2 PUT ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

const prisma = new PrismaClient();
const exp = await prisma.aRExperience.findUnique({ where: { slug } });
if (!exp) {
  console.error(`оживление ${slug} не найдено`);
  process.exit(1);
}

const body = readFileSync(filePath);
const oldPath = exp[field];
if (!oldPath) {
  console.error(`у оживления не задано поле ${field}`);
  process.exit(1);
}
// кладём рядом со старым файлом, в ту же папку оживления
const folder = oldPath.replace(/^r2:/, '').split('/').slice(0, -1).join('/');
const kind = field.replace(/Url$/, '');
const key = `${folder}/${Date.now()}_${kind}_${basename(filePath)}`;

const mb = (n) => (n / (1024 * 1024)).toFixed(2) + ' МБ';

console.log(`оживление : ${slug} (${exp.title}) — поле ${field}`);
console.log(`было      : ${oldPath}`);
console.log(`станет    : r2:${key}`);
console.log(`новый файл: ${mb(statSync(filePath).size)}`);

if (!APPLY) {
  console.log('\nЭто план. Для записи добавьте --apply');
  await prisma.$disconnect();
  process.exit(0);
}

await put(key, body);
await prisma.aRExperience.update({
  where: { id: exp.id },
  data: { [field]: `r2:${key}` },
});
console.log('\nзалито и путь в базе обновлён');
await prisma.$disconnect();

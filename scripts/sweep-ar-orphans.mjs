// Разбор мусора в R2: показывает (и по команде удаляет) файлы в папке ar/,
// на которые не ссылается ни одно оживление.
//
// Такие файлы появляются, если админ залил маркер или видео и закрыл окно, не
// нажав «Сохранить». Сама админка теперь убирает за собой сразу, а этот
// скрипт нужен для того, что накопилось раньше, и как страховка на случай,
// если браузер закрыли жёстко.
//
// По умолчанию только показывает. Чтобы удалить:
//   node --env-file=.env.local scripts/sweep-ar-orphans.mjs --apply
//
// Файлы моложе 24 часов не трогаются: возможно, их прямо сейчас заливают, а
// запись ещё не сохранена. Изменить порог: --hours=6
import { PrismaClient } from '@prisma/client';
import { createHash, createHmac } from 'node:crypto';

const APPLY = process.argv.includes('--apply');
const hoursArg = process.argv.find((a) => a.startsWith('--hours='));
const MIN_AGE_HOURS = hoursArg ? Number(hoursArg.split('=')[1]) : 24;

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET;

if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY || !BUCKET) {
  console.error('Не заданы переменные R2_* — запускайте с --env-file=.env.local');
  process.exit(1);
}

const HOST = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;
const PREFIX = 'ar/';
const prisma = new PrismaClient();

const sha256hex = (d) => createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => createHmac('sha256', k).update(d).digest();
const EMPTY_HASH = sha256hex('');

function authorize(method, uri, query, payloadHash) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const headers = [
    ['host', HOST],
    ['x-amz-content-sha256', payloadHash],
    ['x-amz-date', amzDate],
  ];
  const signed = headers.map(([k]) => k).join(';');
  const canonical = [
    method,
    uri,
    query,
    headers.map(([k, v]) => `${k}:${v}\n`).join(''),
    signed,
    payloadHash,
  ].join('\n');
  const sts = [
    'AWS4-HMAC-SHA256',
    amzDate,
    `${dateStamp}/auto/s3/aws4_request`,
    sha256hex(canonical),
  ].join('\n');
  const kDate = hmac(`AWS4${SECRET_KEY}`, dateStamp);
  const key = hmac(hmac(hmac(kDate, 'auto'), 's3'), 'aws4_request');
  return {
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    Authorization:
      `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${dateStamp}/auto/s3/aws4_request, ` +
      `SignedHeaders=${signed}, Signature=${hmac(key, sts).toString('hex')}`,
  };
}

const encodeKey = (key) =>
  '/' + key.split('/').map(encodeURIComponent).join('/');

async function listAll() {
  const out = [];
  let token;
  do {
    const params = [
      ['list-type', '2'],
      ['max-keys', '1000'],
      ['prefix', PREFIX],
    ];
    if (token) params.push(['continuation-token', token]);
    const query = params
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .sort()
      .join('&');

    const res = await fetch(`https://${HOST}/${BUCKET}?${query}`, {
      headers: authorize('GET', `/${BUCKET}`, query, EMPTY_HASH),
    });
    if (!res.ok) throw new Error(`LIST ${res.status}: ${await res.text()}`);

    const xml = await res.text();
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = m[1].match(/<Key>([\s\S]*?)<\/Key>/);
      const size = m[1].match(/<Size>(\d+)<\/Size>/);
      const mod = m[1].match(/<LastModified>([\s\S]*?)<\/LastModified>/);
      if (!key) continue;
      out.push({
        key: key[1].replace(/&amp;/g, '&'),
        size: size ? Number(size[1]) : 0,
        modified: mod ? new Date(mod[1]) : null,
      });
    }
    const next = xml.match(
      /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/
    );
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) && next ? next[1] : null;
  } while (token);
  return out;
}

async function remove(key) {
  const uri = `/${BUCKET}${encodeKey(key)}`;
  const res = await fetch(`https://${HOST}${uri}`, {
    method: 'DELETE',
    headers: authorize('DELETE', uri, '', EMPTY_HASH),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE ${res.status}: ${await res.text()}`);
  }
}

const FIELDS = [
  'markerUrl',
  'mindFileUrl',
  'contentUrl',
  'posterUrl',
  'maskUrl',
  'textureUrl',
];
const mb = (n) => (n / (1024 * 1024)).toFixed(2) + ' МБ';

// ------------------------------------------------------------------ работа

const rows = await prisma.aRExperience.findMany();
const used = new Set();
for (const exp of rows) {
  for (const f of FIELDS) {
    const v = exp[f];
    if (typeof v === 'string' && v.startsWith('r2:')) used.add(v.slice(3));
  }
  const tracks = Array.isArray(exp.audioTracks) ? exp.audioTracks : [];
  for (const t of tracks) {
    if (typeof t?.path === 'string' && t.path.startsWith('r2:')) {
      used.add(t.path.slice(3));
    }
  }
}

const all = await listAll();
const cutoff = Date.now() - MIN_AGE_HOURS * 3600 * 1000;

const orphans = [];
let tooNew = 0;
for (const obj of all) {
  if (used.has(obj.key)) continue;
  if (obj.modified && obj.modified.getTime() > cutoff) {
    tooNew++;
    continue;
  }
  orphans.push(obj);
}

console.log(`Оживлений в базе: ${rows.length}`);
console.log(`Файлов в ar/:     ${all.length}`);
console.log(`Из них нужных:    ${used.size}`);
if (tooNew) {
  console.log(`Пропущено свежих: ${tooNew} (моложе ${MIN_AGE_HOURS} ч)`);
}

if (!orphans.length) {
  console.log('\nМусора нет — в хранилище только то, что используется.');
} else {
  const total = orphans.reduce((s, o) => s + o.size, 0);
  console.log(`\nНичейных файлов:  ${orphans.length} (${mb(total)})`);
  for (const o of orphans) {
    const age = o.modified
      ? Math.round((Date.now() - o.modified.getTime()) / 86400000) + ' дн.'
      : '?';
    console.log(`  ${mb(o.size).padStart(10)}  ${age.padStart(7)}  ${o.key}`);
  }

  if (!APPLY) {
    console.log('\nЭто просмотр. Чтобы удалить, добавьте --apply');
  } else {
    console.log('\nУдаляю...');
    let done = 0;
    for (const o of orphans) {
      try {
        await remove(o.key);
        done++;
      } catch (e) {
        console.error(`  не удалось: ${o.key} — ${e.message}`);
      }
    }
    console.log(`Удалено: ${done} из ${orphans.length}, освобождено ${mb(total)}`);
  }
}

// Ссылки, для которых файла в хранилище нет — это уже поломка, а не мусор
const missing = [...used].filter((k) => !all.some((o) => o.key === k));
if (missing.length) {
  console.log(`\nВНИМАНИЕ: на эти файлы ссылаются, но их нет в хранилище:`);
  missing.forEach((k) => console.log('  ' + k));
}

await prisma.$disconnect();

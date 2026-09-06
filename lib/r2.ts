// Cloudflare R2 — объектное хранилище с S3-совместимым API.
//
// Зачем оно: у R2 бесплатная раздача. Сейчас файлы лежат в Dropbox, а браузер
// забирает их через наш прокси на Vercel, то есть весь трафик к людям идёт
// через нас и считается нам. После переезда браузер качает напрямую с R2, и
// раздача перестаёт стоить денег вовсе.
//
// SDK не подключаем: из всего протокола нужны две операции — подписать ссылку
// для загрузки и положить файл. Ради этого тянуть в проект несколько мегабайт
// зависимостей незачем, тем более что подпись AWS SigV4 — это шесть строк
// HMAC поверх node:crypto.

import { createHash, createHmac } from 'node:crypto';

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID || '';
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const BUCKET = process.env.R2_BUCKET || '';

// Публичный адрес бакета: свой поддомен (cdn.ar3d.io) либо выданный
// Cloudflare r2.dev-адрес. Именно отсюда браузер качает файлы напрямую.
export const R2_PUBLIC_URL = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '')
  .trim()
  .replace(/\/+$/, '');

// S3-эндпоинт аккаунта — сюда идут подписанные запросы на запись.
const ENDPOINT_HOST = ACCOUNT_ID ? `${ACCOUNT_ID}.r2.cloudflarestorage.com` : '';
const REGION = 'auto'; // R2 не использует регионы, но подпись их требует
const SERVICE = 's3';

export function isR2Configured(): boolean {
  return Boolean(ACCOUNT_ID && ACCESS_KEY && SECRET_KEY && BUCKET);
}

export function r2PublicUrl(key: string): string {
  const clean = key.replace(/^\/+/, '');
  if (!R2_PUBLIC_URL) return '';
  // каждый сегмент кодируем отдельно, чтобы слэши остались слэшами
  const encoded = clean.split('/').map(encodeURIComponent).join('/');
  return `${R2_PUBLIC_URL}/${encoded}`;
}

// ---------------------------------------------------------------- подпись

const sha256hex = (data: string | Buffer) =>
  createHash('sha256').update(data).digest('hex');

const hmac = (key: Buffer | string, data: string) =>
  createHmac('sha256', key).update(data).digest();

function signingKey(dateStamp: string): Buffer {
  const kDate = hmac(`AWS4${SECRET_KEY}`, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, 'aws4_request');
}

function stamps(now = new Date()) {
  const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // 20260906T120000Z
  return { amzDate: amz, dateStamp: amz.slice(0, 8) };
}

function encodeKeyPath(key: string): string {
  return (
    '/' +
    key
      .replace(/^\/+/, '')
      .split('/')
      .map(encodeURIComponent)
      .join('/')
  );
}

// Предподписанная ссылка на загрузку (PUT). Браузер админки кладёт файл прямо
// в R2, минуя наш сервер — иначе упёрлись бы в лимит тела запроса Vercel и
// платили бы за проходящий трафик дважды.
export function presignPutUrl(key: string, expiresSeconds = 3600): string {
  if (!isR2Configured()) throw new Error('R2 не настроен');

  const { amzDate, dateStamp } = stamps();
  const canonicalUri = `/${BUCKET}${encodeKeyPath(key)}`;
  const credential = `${ACCESS_KEY}/${dateStamp}/${REGION}/${SERVICE}/aws4_request`;

  const params: Array<[string, string]> = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', credential],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(expiresSeconds)],
    ['X-Amz-SignedHeaders', 'host'],
  ];
  const canonicalQuery = params
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .sort()
    .join('&');

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuery,
    `host:${ENDPOINT_HOST}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    `${dateStamp}/${REGION}/${SERVICE}/aws4_request`,
    sha256hex(canonicalRequest),
  ].join('\n');

  const signature = hmac(signingKey(dateStamp), stringToSign).toString('hex');
  return `https://${ENDPOINT_HOST}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

// Прямая запись с сервера — нужна скрипту переноса из Dropbox.
export async function putObject(
  key: string,
  body: Buffer,
  contentType?: string
): Promise<void> {
  if (!isR2Configured()) throw new Error('R2 не настроен');

  const { amzDate, dateStamp } = stamps();
  const canonicalUri = `/${BUCKET}${encodeKeyPath(key)}`;
  const payloadHash = sha256hex(body);
  const type = contentType || 'application/octet-stream';

  const headers: Array<[string, string]> = [
    ['content-type', type],
    ['host', ENDPOINT_HOST],
    ['x-amz-content-sha256', payloadHash],
    ['x-amz-date', amzDate],
  ];
  const signedHeaders = headers.map(([k]) => k).join(';');
  const canonicalHeaders = headers.map(([k, v]) => `${k}:${v}\n`).join('');

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    `${dateStamp}/${REGION}/${SERVICE}/aws4_request`,
    sha256hex(canonicalRequest),
  ].join('\n');

  const signature = hmac(signingKey(dateStamp), stringToSign).toString('hex');
  const credential = `${ACCESS_KEY}/${dateStamp}/${REGION}/${SERVICE}/aws4_request`;

  const res = await fetch(`https://${ENDPOINT_HOST}${canonicalUri}`, {
    method: 'PUT',
    headers: {
      'content-type': type,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${credential}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body: new Uint8Array(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`R2 PUT ${res.status}: ${text.slice(0, 300)}`);
  }
}

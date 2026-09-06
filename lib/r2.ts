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

// Публичная часть (адрес файла, пометка хранилища) вынесена отдельно: её
// тянут и клиентские компоненты, а сюда нельзя — здесь node:crypto и секреты.
export {
  isR2Path,
  r2Key,
  r2Path,
  r2PublicUrl,
  R2_PREFIX,
  R2_PUBLIC_URL,
} from './r2-public';

// S3-эндпоинт аккаунта — сюда идут подписанные запросы на запись.
const ENDPOINT_HOST = ACCOUNT_ID ? `${ACCOUNT_ID}.r2.cloudflarestorage.com` : '';
const REGION = 'auto'; // R2 не использует регионы, но подпись их требует
const SERVICE = 's3';

export function isR2Configured(): boolean {
  return Boolean(ACCOUNT_ID && ACCESS_KEY && SECRET_KEY && BUCKET);
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

// Заголовки для запроса от нашего сервера. Общая часть всех операций ниже:
// SigV4 требует подписать метод, путь, строку запроса и набор заголовков.
function authorize(
  method: string,
  canonicalUri: string,
  canonicalQuery: string,
  payloadHash: string,
  extra: Array<[string, string]> = []
): Record<string, string> {
  const { amzDate, dateStamp } = stamps();

  // подписываемые заголовки обязаны идти в алфавитном порядке
  const headers: Array<[string, string]> = [
    ...extra,
    ['host', ENDPOINT_HOST],
    ['x-amz-content-sha256', payloadHash],
    ['x-amz-date', amzDate],
  ];
  headers.sort((a, b) => (a[0] < b[0] ? -1 : 1));

  const signedHeaders = headers.map(([k]) => k).join(';');
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    headers.map(([k, v]) => `${k}:${v}\n`).join(''),
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

  const out: Record<string, string> = {
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    Authorization:
      `AWS4-HMAC-SHA256 Credential=${credential}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
  for (const [k, v] of extra) out[k] = v;
  return out;
}

// Прямая запись с сервера — нужна скрипту переноса из Dropbox.
export async function putObject(
  key: string,
  body: Buffer,
  contentType?: string
): Promise<void> {
  if (!isR2Configured()) throw new Error('R2 не настроен');

  const canonicalUri = `/${BUCKET}${encodeKeyPath(key)}`;
  const type = contentType || 'application/octet-stream';
  const headers = authorize('PUT', canonicalUri, '', sha256hex(body), [
    ['content-type', type],
  ]);

  const res = await fetch(`https://${ENDPOINT_HOST}${canonicalUri}`, {
    method: 'PUT',
    headers,
    body: new Uint8Array(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`R2 PUT ${res.status}: ${text.slice(0, 300)}`);
  }
}

const EMPTY_HASH = sha256hex('');

// Удаление объекта. Отсутствующий объект — не ошибка: R2 на DELETE
// несуществующего ключа отвечает 204, и нам это подходит, потому что чистка
// вызывается «на всякий случай» и не должна ронять запрос админки.
export async function deleteObject(key: string): Promise<void> {
  if (!isR2Configured()) throw new Error('R2 не настроен');

  const canonicalUri = `/${BUCKET}${encodeKeyPath(key)}`;
  const res = await fetch(`https://${ENDPOINT_HOST}${canonicalUri}`, {
    method: 'DELETE',
    headers: authorize('DELETE', canonicalUri, '', EMPTY_HASH),
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`R2 DELETE ${res.status}: ${text.slice(0, 300)}`);
  }
}

const XML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

export interface R2Object {
  key: string;
  size: number;
  lastModified: Date | null;
}

const unescapeXml = (s: string) =>
  s.replace(/&(?:amp|lt|gt|quot|apos);/g, (e) => XML_ENTITIES[e]);

// Содержимое папки. Нужно, чтобы при удалении оживления вымести её целиком,
// включая файлы, на которые запись уже не ссылается (заменённые маркеры,
// брошенные загрузки). Дата нужна отдельно: скрипт разбора мусора не должен
// трогать файл, который прямо сейчас заливают.
export async function listObjects(prefix: string): Promise<R2Object[]> {
  if (!isR2Configured()) throw new Error('R2 не настроен');

  const objects: R2Object[] = [];
  let token: string | undefined;

  do {
    const params: Array<[string, string]> = [
      ['list-type', '2'],
      ['max-keys', '1000'],
      ['prefix', prefix],
    ];
    if (token) params.push(['continuation-token', token]);

    const canonicalQuery = params
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .sort()
      .join('&');
    const canonicalUri = `/${BUCKET}`;

    const res = await fetch(
      `https://${ENDPOINT_HOST}${canonicalUri}?${canonicalQuery}`,
      { headers: authorize('GET', canonicalUri, canonicalQuery, EMPTY_HASH) }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`R2 LIST ${res.status}: ${text.slice(0, 300)}`);
    }

    const xml = await res.text();
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const chunk = m[1];
      const key = chunk.match(/<Key>([\s\S]*?)<\/Key>/);
      if (!key) continue;
      const size = chunk.match(/<Size>(\d+)<\/Size>/);
      const modified = chunk.match(/<LastModified>([\s\S]*?)<\/LastModified>/);
      objects.push({
        key: unescapeXml(key[1]),
        size: size ? Number(size[1]) : 0,
        lastModified: modified ? new Date(modified[1]) : null,
      });
    }
    const next = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/);
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) && next ? next[1] : undefined;
  } while (token);

  return objects;
}

export async function listObjectKeys(prefix: string): Promise<string[]> {
  return (await listObjects(prefix)).map((o) => o.key);
}

// Серверные помощники WebAR-модуля. Импортировать только из серверного кода
// (route handlers, серверные компоненты) — тянет за собой lib/dropbox.
import { getTemporaryLink, getTemporaryUploadLink } from '@/lib/dropbox';
import { AR_DROPBOX_DIR, type ARAssetKind } from './constants';

function sanitizeFilename(name: string) {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
  return cleaned || `file_${Date.now()}`;
}

// Путь в Dropbox для нового AR-ассета: /ar/<timestamp>_<kind>_<safe-name>
export function buildARAssetPath(kind: ARAssetKind, filename: string) {
  return `${AR_DROPBOX_DIR}/${Date.now()}_${kind}_${sanitizeFilename(filename)}`;
}

// Одноразовая ссылка для прямой загрузки ассета в Dropbox из браузера админки.
export async function createARUploadLink(kind: ARAssetKind, filename: string) {
  const path = buildARAssetPath(kind, filename);
  const uploadUrl = await getTemporaryUploadLink(path);
  return { uploadUrl, path };
}

// Резолвит хранимый путь (Dropbox `/ar/...` или уже готовый http-URL) во
// временную ссылку. Временные ссылки Dropbox живут ~4 часа, поэтому
// вызывается на каждый запрос страницы/прокси, а не кэшируется надолго.
export async function resolveARAssetUrl(path: string): Promise<string> {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return getTemporaryLink(path);
}

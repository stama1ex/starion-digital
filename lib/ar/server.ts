// Серверные помощники WebAR-модуля. Импортировать только из серверного кода
// (route handlers, серверные компоненты) — тянет за собой lib/dropbox.
//
// Хранилищ два, и это намеренно. Новые файлы кладутся в Cloudflare R2 (у него
// бесплатная раздача, и браузер качает их напрямую, минуя наш сервер), а всё,
// что залито раньше, остаётся в Dropbox и продолжает работать. Отличаются они
// префиксом в пути: 'r2:ar/...' против '/ar/...'. Благодаря этому переносить
// можно по одному файлу и в любой момент остановиться.
import { getTemporaryLink, getTemporaryUploadLink } from '@/lib/dropbox';
import { isR2Configured, presignPutUrl, r2PublicUrl } from '@/lib/r2';
import { AR_DROPBOX_DIR, type ARAssetKind } from './constants';

export const R2_PREFIX = 'r2:';

export function isR2Path(path: string | null | undefined): boolean {
  return typeof path === 'string' && path.startsWith(R2_PREFIX);
}

export function r2Key(path: string): string {
  return path.slice(R2_PREFIX.length);
}

function sanitizeFilename(name: string) {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
  return cleaned || `file_${Date.now()}`;
}

// Имя папки опыта в Dropbox из названия, которое ввёл админ. Кириллицу
// оставляем (Dropbox её принимает) — папка должна быть узнаваемой глазами;
// убираем только то, что нельзя в путях, и подрезаем длину.
export function sanitizeARFolder(title: string | undefined | null) {
  const cleaned = String(title ?? '')
    .replace(/[\\/:*?"<>|]/g, '-') // запрещённые в путях символы
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '') // Dropbox не любит точки/пробелы по краям
    .slice(0, 80)
    .trim();
  return cleaned || '_без-названия';
}

// Путь в Dropbox для нового AR-ассета:
//   /ar/<Название опыта>/<timestamp>_<kind>_<safe-name>
// Папка на опыт нужна, чтобы ассеты одного сувенира лежали вместе, а не
// вперемешку в общей куче. Если название ещё не введено — складываем
// в /ar/_без-названия и потом можно перенести руками.
export function buildARAssetPath(
  kind: ARAssetKind,
  filename: string,
  title?: string
) {
  const folder = sanitizeARFolder(title);
  return `${AR_DROPBOX_DIR}/${folder}/${Date.now()}_${kind}_${sanitizeFilename(filename)}`;
}

// Ссылка для прямой загрузки ассета из браузера админки, минуя наш сервер:
// иначе упёрлись бы в лимит тела запроса Vercel, да ещё и платили бы за
// проходящий трафик. Куда именно грузить — решает наличие настроек R2.
export async function createARUploadLink(
  kind: ARAssetKind,
  filename: string,
  title?: string
) {
  const dropboxPath = buildARAssetPath(kind, filename, title);

  if (isR2Configured()) {
    // ключ в R2 повторяет структуру папок Dropbox, только без ведущего слэша
    const key = dropboxPath.replace(/^\/+/, '');
    return {
      uploadUrl: presignPutUrl(key),
      path: `${R2_PREFIX}${key}`,
      // R2 принимает файл только PUT-запросом, Dropbox ждёт POST
      method: 'PUT' as const,
    };
  }

  const uploadUrl = await getTemporaryUploadLink(dropboxPath);
  return { uploadUrl, path: dropboxPath, method: 'POST' as const };
}

// Резолвит хранимый путь (Dropbox `/ar/...` или уже готовый http-URL) во
// временную ссылку. Временные ссылки Dropbox живут ~4 часа, поэтому
// вызывается на каждый запрос страницы/прокси, а не кэшируется надолго.
export async function resolveARAssetUrl(path: string): Promise<string> {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  // У R2 адрес постоянный и публичный — ходить за ним никуда не надо
  if (isR2Path(path)) return r2PublicUrl(r2Key(path));
  return getTemporaryLink(path);
}

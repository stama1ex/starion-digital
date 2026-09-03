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

// Одноразовая ссылка для прямой загрузки ассета в Dropbox из браузера админки.
export async function createARUploadLink(
  kind: ARAssetKind,
  filename: string,
  title?: string
) {
  const path = buildARAssetPath(kind, filename, title);
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

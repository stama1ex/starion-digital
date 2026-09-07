// Серверные помощники WebAR-модуля. Импортировать только из серверного кода
// (route handlers, серверные компоненты).
//
// Все файлы оживлений лежат в Cloudflare R2: у него бесплатная раздача, и
// браузер качает их напрямую, минуя наш сервер. В базе путь помечен
// префиксом 'r2:' — пометка осталась с переезда, когда файлы какое-то время
// жили в двух местах сразу.
import {
  isR2Path,
  presignPutUrl,
  r2Key,
  r2Path,
  r2PublicUrl,
  R2_PREFIX,
} from '@/lib/r2';
import { AR_STORAGE_DIR, type ARAssetKind } from './constants';

// Пометка хранилища живёт в lib/r2 — она нужна не только AR, но и картинкам
// товаров. Здесь оставлен реэкспорт, чтобы не переписывать импорты.
export { isR2Path, r2Key, R2_PREFIX };

function sanitizeFilename(name: string) {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
  return cleaned || `file_${Date.now()}`;
}

// Имя папки оживления из названия, которое ввёл админ. Кириллицу оставляем —
// папка должна быть узнаваемой глазами; убираем только то, что нельзя
// в путях, и подрезаем длину.
export function sanitizeARFolder(title: string | undefined | null) {
  const cleaned = String(title ?? '')
    .replace(/[\\/:*?"<>|]/g, '-') // запрещённые в путях символы
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 80)
    .trim();
  return cleaned || '_без-названия';
}

// Ключ нового файла оживления:
//   ar/<Название опыта>/<timestamp>_<kind>_<safe-name>
// Папка на опыт нужна, чтобы файлы одного сувенира лежали вместе, а не
// вперемешку в общей куче. Метка времени в имени означает, что файл по
// существующему ключу никогда не перезаписывается, поэтому кэш браузера
// и CDN не может разойтись с содержимым.
export function buildARAssetKey(
  kind: ARAssetKind,
  filename: string,
  title?: string
) {
  const folder = sanitizeARFolder(title);
  return `${AR_STORAGE_DIR}/${folder}/${Date.now()}_${kind}_${sanitizeFilename(filename)}`;
}

// Ссылка для прямой загрузки файла из браузера админки, минуя наш сервер:
// иначе упёрлись бы в лимит тела запроса Vercel, да ещё и платили бы за
// проходящий трафик.
export async function createARUploadLink(
  kind: ARAssetKind,
  filename: string,
  title?: string
) {
  const key = buildARAssetKey(kind, filename, title);
  return {
    uploadUrl: presignPutUrl(key),
    path: r2Path(key),
    method: 'PUT' as const,
  };
}

// Хранимый путь -> адрес файла. У R2 он постоянный и публичный, поэтому
// никаких сетевых запросов здесь нет.
export async function resolveARAssetUrl(path: string): Promise<string> {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (isR2Path(path)) return r2PublicUrl(r2Key(path));
  return '';
}

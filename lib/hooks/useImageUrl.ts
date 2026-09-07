import { isR2Path, r2Key, r2PublicUrl } from '@/lib/r2-public';

function toLocalPath(path: string) {
  const normalized = path.replace(/^public\//, '').replace(/^\/+/, '');
  return `/${normalized}`;
}

/**
 * Адрес картинки по её пути в базе. Путей три вида:
 *   'r2:products/…'   — файл в R2, адрес постоянный
 *   'magnets/01.avif' — статика из public/, отдаёт Vercel
 *   'https://…'       — уже готовый адрес (старые данные)
 *
 * Раньше здесь был четвёртый вид — '/products/…' из Dropbox, и на него
 * приходилось спрашивать временную ссылку у нашего сервера, то есть ждать
 * ответа на каждую карточку. Теперь адрес считается на месте, без сети.
 */
export function imageUrl(path: string | null | undefined): string {
  if (!path || !path.trim()) return '';
  if (path.startsWith('http')) return path;
  if (isR2Path(path)) return r2PublicUrl(r2Key(path));
  return toLocalPath(path);
}

// Обёртка сохраняет форму прежнего хука ({ imgSrc, loading, error }), чтобы
// карточки товаров не пришлось переписывать. Ожидания больше нет, поэтому
// loading всегда false: картинку дальше грузит сам <img>.
export function useImageUrl(path: string | null | undefined) {
  return { imgSrc: imageUrl(path), loading: false, error: false };
}

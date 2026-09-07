// Где лежат картинки товаров.
//
// Видов пути два:
//   'magnets/01.avif'       — статика из public/, лежит в самом репозитории
//   'r2:products/123_a.jpg' — Cloudflare R2, туда грузит админка
//
// Адрес файла в R2 постоянный, поэтому браузер идёт за картинкой сразу.
// Раньше картинки лежали в Dropbox, где ссылка временная, и на каждую нужен
// был запрос к их API — прямо на критическом пути отрисовки каталога.
export const PRODUCTS_R2_DIR = 'products';

export function sanitizeProductFilename(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '') || `file_${Date.now()}`
  );
}

// Имя с меткой времени: файл по существующему ключу никогда не
// перезаписывается, поэтому кэш браузера и CDN не может разойтись
// с содержимым.
export function buildProductImageKey(filename: string): string {
  return `${PRODUCTS_R2_DIR}/${Date.now()}_${sanitizeProductFilename(filename)}`;
}

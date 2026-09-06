// Где лежат картинки товаров.
//
// Историй три, и все три ещё живы:
//   'magnets/01.avif'      — статика из public/, лежит в самом репозитории
//   '/products/123_a.jpg'  — Dropbox, старые загрузки через админку
//   'r2:products/123_a.jpg' — Cloudflare R2, куда всё переезжает
//
// R2 быстрее не потому, что «облако лучше», а потому что адрес файла там
// постоянный: браузер идёт за картинкой сразу. У Dropbox ссылка временная,
// поэтому на каждую картинку нужен запрос к их API — и он попадает
// на критический путь отрисовки каталога.
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

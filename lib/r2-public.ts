// Публичная часть работы с R2: как выглядит путь в базе и как из него
// получить адрес файла. Без серверных зависимостей — этот модуль тянут и
// клиентские компоненты (карточка товара, превью в админке), поэтому здесь
// не должно появиться ни node:crypto, ни обращений к секретам.

// В базе путь к файлу хранится с пометкой хранилища: 'r2:products/...' — это
// R2, '/products/...' без пометки — старый файл в Dropbox. Так переезд можно
// вести по одному файлу и в любой момент остановиться.
export const R2_PREFIX = 'r2:';

// Намеренно возвращает boolean, а не тип-предикат `path is string`: предикат
// сузил бы отрицательную ветку до never везде, где на входе уже string, и
// сломал бы все последующие проверки вида `image.startsWith('/products/')`.
export function isR2Path(path: unknown): boolean {
  return typeof path === 'string' && path.startsWith(R2_PREFIX);
}

export function r2Key(path: string): string {
  return path.slice(R2_PREFIX.length);
}

export function r2Path(key: string): string {
  return `${R2_PREFIX}${key.replace(/^\/+/, '')}`;
}

// Публичный адрес бакета: свой поддомен (cdn.ar3d.io). Именно отсюда браузер
// качает файлы напрямую — постоянной ссылкой, без обращения к нашему серверу
// и без срока годности, в отличие от временных ссылок Dropbox.
export const R2_PUBLIC_URL = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '')
  .trim()
  .replace(/\/+$/, '');

export function r2PublicUrl(key: string): string {
  const clean = key.replace(/^\/+/, '');
  if (!R2_PUBLIC_URL) return '';
  // каждый сегмент кодируем отдельно, чтобы слэши остались слэшами
  const encoded = clean.split('/').map(encodeURIComponent).join('/');
  return `${R2_PUBLIC_URL}/${encoded}`;
}

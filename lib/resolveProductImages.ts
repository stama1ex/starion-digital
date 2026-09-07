import { imageUrl } from './hooks/useImageUrl';

/**
 * Адрес картинки товара. Раньше здесь на каждую карточку каталога уходил
 * запрос к API Dropbox за временной ссылкой — прямо на критическом пути
 * отрисовки. Теперь все файлы лежат в R2 или в public/, адрес постоянный,
 * и функция сводится к разбору строки.
 *
 * Асинхронной оставлена намеренно: её ждут страницы каталога, и менять
 * их сигнатуры ради одной снятой сетевой операции незачем.
 */
export async function resolveImageUrl(image: string): Promise<string> {
  return imageUrl(image);
}

export async function resolveProductImages<T extends { image: string }>(
  products: T[],
): Promise<T[]> {
  if (products.length === 0) return products;
  return products.map((p) => ({ ...p, image: imageUrl(p.image) }));
}

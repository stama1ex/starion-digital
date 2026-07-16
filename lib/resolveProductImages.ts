import { getAccessToken, getTemporaryLink } from './dropbox';

function toLocalPath(path: string) {
  const normalized = path.replace(/^public\//, '').replace(/^\/+/, '');
  return `/${normalized}`;
}

// Резолвит один путь к картинке товара в реальный URL. Для путей Dropbox
// (/products/...) в случае ошибки возвращает исходный путь как есть, чтобы
// клиентский useDropboxImage мог сам попробовать его разрешить как fallback.
export async function resolveImageUrl(
  image: string,
  accessToken: string,
): Promise<string> {
  if (!image || !image.trim()) return image;

  if (image.startsWith('http')) {
    return image;
  }

  if (image.startsWith('public/')) {
    return toLocalPath(image);
  }

  if (image.startsWith('/products/')) {
    try {
      return await getTemporaryLink(image, accessToken);
    } catch (err) {
      console.error('Error resolving Dropbox link for', image, err);
      return image;
    }
  }

  return toLocalPath(image);
}

// Резолвит поле image у списка товаров одним батчем (общий access token,
// параллельно) — чтобы каталог не дёргал /api/dropbox/temp-link на каждую
// карточку отдельно с клиента.
export async function resolveProductImages<T extends { image: string }>(
  products: T[],
): Promise<T[]> {
  if (products.length === 0) return products;

  const accessToken = await getAccessToken();
  return Promise.all(
    products.map(async (p) => ({
      ...p,
      image: await resolveImageUrl(p.image, accessToken),
    })),
  );
}

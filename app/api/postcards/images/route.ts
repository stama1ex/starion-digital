import { prisma } from '@/lib/db';
import { getAccessToken, getTemporaryLink } from '@/lib/dropbox';

export const dynamic = 'force-dynamic';

// Временные ссылки Dropbox живут 4 часа — держим их в памяти процесса
// 30 минут, чтобы не резолвить их заново на каждый заход на главную.
const CACHE_TTL_MS = 30 * 60 * 1000;
let cache: { urls: string[]; cachedAt: number } | null = null;

function toLocalPath(path: string) {
  const normalized = path.replace(/^public\//, '').replace(/^\/+/, '');
  return `/${normalized}`;
}

async function resolveImageUrl(
  image: string,
  accessToken: string,
): Promise<string | null> {
  if (!image || !image.trim()) return null;

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
      return null;
    }
  }

  return toLocalPath(image);
}

// Отдаём ссылки построчно (NDJSON), чтобы на клиенте карточки открыток
// появлялись по мере готовности, а не все разом после самой медленной.
export async function GET() {
  const encoder = new TextEncoder();

  if (cache && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
    const cached = cache.urls;
    const stream = new ReadableStream({
      start(controller) {
        for (const url of cached) {
          controller.enqueue(encoder.encode(JSON.stringify(url) + '\n'));
        }
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
    });
  }

  const products = await prisma.product.findMany({
    where: { type: 'POSTCARD', isHidden: false },
    orderBy: { number: 'asc' },
    select: { image: true },
    take: 20,
  });

  const stream = new ReadableStream({
    async start(controller) {
      const resolved: string[] = [];
      try {
        const accessToken = await getAccessToken();
        await Promise.all(
          products.map(async (p) => {
            const url = await resolveImageUrl(p.image, accessToken);
            if (url) {
              resolved.push(url);
              controller.enqueue(encoder.encode(JSON.stringify(url) + '\n'));
            }
          }),
        );
        cache = { urls: resolved, cachedAt: Date.now() };
      } catch (err) {
        console.error('Error resolving postcard images:', err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
  });
}

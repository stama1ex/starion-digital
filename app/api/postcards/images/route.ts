import { prisma } from '@/lib/db';
import { getAccessToken } from '@/lib/dropbox';
import { resolveImageUrl } from '@/lib/resolveProductImages';

export const dynamic = 'force-dynamic';

// Временные ссылки Dropbox живут 4 часа — держим их в памяти процесса
// 30 минут, чтобы не резолвить их заново на каждый заход на главную.
const CACHE_TTL_MS = 30 * 60 * 1000;
let cache: { urls: string[]; cachedAt: number } | null = null;

// В отличие от каталога, карусель на главной не умеет резолвить сырой
// путь /products/... на клиенте (нет фолбэка через useDropboxImage),
// поэтому при неудачном резолве Dropbox-ссылку просто пропускаем.
async function resolvePostcardImage(
  image: string,
  accessToken: string,
): Promise<string | null> {
  if (!image || !image.trim()) return null;
  const resolved = await resolveImageUrl(image, accessToken);
  if (!resolved || resolved.startsWith('/products/')) return null;
  return resolved;
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
            const url = await resolvePostcardImage(p.image, accessToken);
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

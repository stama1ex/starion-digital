import { prisma } from '@/lib/db';
import { resolveImageUrl } from '@/lib/resolveProductImages';

export const dynamic = 'force-dynamic';

// Кэш остался от времён, когда адреса приходилось спрашивать у Dropbox.
// Сейчас резолв бесплатный, но кэш экономит поход в базу на каждый заход
// на главную, поэтому оставлен.
const CACHE_TTL_MS = 30 * 60 * 1000;
let cache: { urls: string[]; cachedAt: number } | null = null;

async function resolvePostcardImage(image: string): Promise<string | null> {
  if (!image || !image.trim()) return null;
  return (await resolveImageUrl(image)) || null;
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
        await Promise.all(
          products.map(async (p) => {
            const url = await resolvePostcardImage(p.image);
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

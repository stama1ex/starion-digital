import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveARAssetUrl } from '@/lib/ar/server';
import { AR_ASSET_KINDS, type ARAssetKind } from '@/lib/ar/constants';

// Всегда динамический — резолвит свежую временную ссылку Dropbox на каждый
// запрос (они живут ~4 часа).
export const dynamic = 'force-dynamic';

const KIND_TO_FIELD: Record<
  ARAssetKind,
  'markerUrl' | 'mindFileUrl' | 'contentUrl' | 'posterUrl'
> = {
  marker: 'markerUrl',
  mind: 'mindFileUrl',
  content: 'contentUrl',
  poster: 'posterUrl',
};

// Публичный прокси AR-ассетов: /api/ar/{slug}/asset?kind=marker|mind|content|poster
// Отдаёт файл с того же origin, что и страница — это нужно, чтобы THREE.VideoTexture
// и MindAR (fetch .mind) работали без CORS-заморочек и без утечки путей Dropbox
// на клиент. Поддерживает Range для перемотки видео.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const kind = request.nextUrl.searchParams.get('kind') as ARAssetKind | null;

  if (!kind || !AR_ASSET_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'kind is required' }, { status: 400 });
  }

  const experience = await prisma.aRExperience.findUnique({
    where: { slug },
    select: {
      isActive: true,
      markerUrl: true,
      mindFileUrl: true,
      contentUrl: true,
      posterUrl: true,
    },
  });

  if (!experience || !experience.isActive) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let path = experience[KIND_TO_FIELD[kind]];
  if (kind === 'poster' && !path) path = experience.markerUrl; // разумный fallback

  if (!path) {
    return NextResponse.json({ error: 'Asset is not set' }, { status: 404 });
  }

  let upstreamUrl: string;
  try {
    upstreamUrl = await resolveARAssetUrl(path);
  } catch (error) {
    console.error(`[AR asset] resolve failed for ${slug}/${kind}:`, error);
    return NextResponse.json({ error: 'Asset unavailable' }, { status: 502 });
  }

  const range = request.headers.get('range');
  const upstream = await fetch(upstreamUrl, {
    headers: range ? { Range: range } : undefined,
    // временная ссылка Dropbox сама одноразово-подписана, кэш не нужен
    cache: 'no-store',
  });

  if (!upstream.ok && upstream.status !== 206) {
    console.error(
      `[AR asset] upstream ${upstream.status} for ${slug}/${kind}`
    );
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }

  const headers = new Headers();
  for (const h of [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'etag',
    'last-modified',
  ]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (kind === 'mind') headers.set('content-type', 'application/octet-stream');
  if (!headers.has('accept-ranges') && kind === 'content') {
    headers.set('accept-ranges', 'bytes');
  }
  // Первое сканирование оплачивает проксирование, дальше отдаёт CDN Vercel.
  headers.set(
    'cache-control',
    'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'
  );

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}

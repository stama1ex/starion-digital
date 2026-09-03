import { NextResponse, type NextRequest } from 'next/server';
import { isARDomainHost, isARDomainPath } from '@/lib/ar/domain';

// Единственная задача — запереть отдельный AR-домен на вьюере (см.
// lib/ar/domain.ts). На основном домене middleware сразу пропускает запрос
// дальше, а пока NEXT_PUBLIC_AR_SHORT_URL пуст, он не делает вообще ничего.
export function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  if (!isARDomainHost(host)) return NextResponse.next();

  if (isARDomainPath(request.nextUrl.pathname)) return NextResponse.next();

  // Не редирект на основной сайт: адрес в строке — ровно то, что мы прячем.
  return new NextResponse('Not found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}

export const config = {
  // Статику и картинки Next пропускаем мимо middleware — они нужны самому
  // вьюеру, и гонять их через edge незачем.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

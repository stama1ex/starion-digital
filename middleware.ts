import { NextResponse, type NextRequest } from 'next/server';
import { isARDomainHost, isARDomainPath } from '@/lib/ar/domain';

// Две задачи: запереть отдельный AR-домен на вьюере (см. lib/ar/domain.ts) и
// пробросить путь запроса в корневой layout. Пока NEXT_PUBLIC_AR_SHORT_URL
// пуст, первая часть не делает ничего.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host');

  if (isARDomainHost(host) && !isARDomainPath(pathname)) {
    // Не редирект на основной сайт: адрес в строке — ровно то, что мы прячем.
    return new NextResponse('Not found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  }

  // Корневой layout — серверный компонент и путь сам не видит, а на странице
  // оживления шапка, подвал и cookie-баннер сайта не нужны: вьюер занимает
  // весь экран, а при белой метке они ещё и выдавали бы нас в исходном коде.
  const headers = new Headers(request.headers);
  headers.set('x-pathname', pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Статику и картинки Next пропускаем мимо middleware — они нужны самому
  // вьюеру, и гонять их через edge незачем.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

import { NextResponse, type NextRequest } from 'next/server';
import { arShortSlug, isARDomainHost, isARDomainPath } from '@/lib/ar/domain';

// Три задачи: запереть отдельный AR-домен на вьюере (см. lib/ar/domain.ts),
// принять там короткий адрес вида ar3d.io/test и пробросить путь запроса
// в корневой layout. Пока NEXT_PUBLIC_AR_SHORT_URL пуст, первые две части
// не делают ничего.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host');

  // Корневой layout — серверный компонент и путь сам не видит, а на странице
  // оживления шапка, подвал и cookie-баннер сайта не нужны: вьюер занимает
  // весь экран, а при белой метке они ещё и выдавали бы нас в исходном коде.
  const headers = new Headers(request.headers);

  if (isARDomainHost(host)) {
    const slug = arShortSlug(pathname);
    if (slug) {
      // ar3d.io/test — тот же вьюер, что и ar3d.io/ar/test. Именно подмена,
      // а не редирект: в адресной строке остаётся короткий адрес, и старые
      // напечатанные QR с /ar/... продолжают работать как работали.
      const url = request.nextUrl.clone();
      url.pathname = `/ar/${slug}`;
      headers.set('x-pathname', url.pathname);
      return NextResponse.rewrite(url, { request: { headers } });
    }

    if (!isARDomainPath(pathname)) {
      // Не редирект на основной сайт: адрес в строке — ровно то, что мы прячем.
      return new NextResponse('Not found', {
        status: 404,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'x-robots-tag': 'noindex, nofollow',
        },
      });
    }
  }

  headers.set('x-pathname', pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Статику и картинки Next пропускаем мимо middleware — они нужны самому
  // вьюеру, и гонять их через edge незачем. А вот favicon.ico исключать нельзя:
  // на AR-домене он должен отдавать 404, иначе по прямому запросу приезжает
  // иконка основного сайта в обход нейтральной, объявленной в <link rel=icon>.
  matcher: ['/((?!_next/static|_next/image).*)'],
};

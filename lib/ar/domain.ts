// Отдельный домен под AR.
//
// Сувениры делаются и под чужим брендом, поэтому приложение может обслуживаться
// на своём домене (в Vercel он добавляется к тому же проекту алиасом — это не
// редирект, страница реально живёт на нём, и камере достаётся обычный
// secure-context origin). Тогда основной адрес не попадает ни в QR, ни в
// адресную строку.
//
// Домен задаётся один раз через NEXT_PUBLIC_AR_SHORT_URL. Пока переменная
// пустая, весь этот код — no-op: ничего не блокируется, ссылки строятся от
// текущего origin.

// Адрес основного сайта живёт в lib/site.ts — он нужен не только AR-модулю.
export { SITE_URL } from '@/lib/site';

export const AR_DOMAIN_URL = (process.env.NEXT_PUBLIC_AR_SHORT_URL || '')
  .trim()
  .replace(/\/+$/, '');

// Хост без схемы и порта — с ним сравнивается заголовок Host входящего запроса.
export const AR_DOMAIN_HOST = (() => {
  if (!AR_DOMAIN_URL) return '';
  try {
    return new URL(AR_DOMAIN_URL).hostname.toLowerCase();
  } catch {
    // не URL, а голый хост — тоже принимаем
    return AR_DOMAIN_URL.toLowerCase().split('/')[0];
  }
})();

// www.ar3d.io и ar3d.io — для нас один и тот же AR-домен. Без этого стоит
// завести в Vercel www-вариант, и на нём откроется весь сайт в обход замка.
const bare = (host: string) => host.replace(/^www\./, '');

// На AR-домене отдаётся только вьюер: /ar/* и прокси ассетов /api/ar/*.
// Остальной сайт там недоступен — иначе на нём открывался бы весь каталог со
// всем брендингом, да ещё и дублировал бы основной домен для поисковиков.
export function isARDomainHost(host: string | null | undefined): boolean {
  if (!AR_DOMAIN_HOST || !host) return false;
  return bare(host.toLowerCase().split(':')[0]) === bare(AR_DOMAIN_HOST);
}

// Нейтральная иконка вкладки для белой метки. Без неё браузер по привычке
// просит /favicon.ico, а он на этом домене закрыт — и вкладка остаётся
// вообще без значка.
export const AR_NEUTRAL_ICON = '/ar-icon.svg';

export function isARDomainPath(pathname: string): boolean {
  return (
    pathname.startsWith('/ar/') ||
    pathname.startsWith('/api/ar/') ||
    pathname === AR_NEUTRAL_ICON
  );
}

// Короткий адрес вьюера: на своём домене slug лежит прямо в корне
// (ar3d.io/test вместо ar3d.io/ar/test). Ссылка получается короче, а QR при
// slug до десяти символов умещается в меньшую версию кода — модули крупнее,
// и телефон читает его с большего расстояния.
//
// Возвращает slug, если путь выглядит как короткий адрес. Условие строгое —
// ровно один сегмент по правилам slug, поэтому ни /favicon.ico, ни
// /ar-icon.svg, ни /magnets/catalog сюда не попадают.
export function arShortSlug(pathname: string): string | null {
  const match = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(pathname);
  return match ? match[1] : null;
}

// Путь вьюера для ссылки. Короткий — только на отдельном AR-домене: на
// основном сайте в корне живут настоящие страницы (/contacts, /partnership),
// и slug рано или поздно с одной из них столкнётся.
export function arViewerPath(slug: string): string {
  return AR_DOMAIN_URL ? `/${slug}` : `/ar/${slug}`;
}

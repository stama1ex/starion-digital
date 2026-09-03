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

// На AR-домене отдаётся только вьюер: /ar/* и прокси ассетов /api/ar/*.
// Остальной сайт там недоступен — иначе на нём открывался бы весь каталог со
// всем брендингом, да ещё и дублировал бы основной домен для поисковиков.
export function isARDomainHost(host: string | null | undefined): boolean {
  if (!AR_DOMAIN_HOST || !host) return false;
  return host.toLowerCase().split(':')[0] === AR_DOMAIN_HOST;
}

export function isARDomainPath(pathname: string): boolean {
  return pathname.startsWith('/ar/') || pathname.startsWith('/api/ar/');
}

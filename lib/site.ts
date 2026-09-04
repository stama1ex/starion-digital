// Канонический адрес сайта — один на весь проект.
//
// В Vercel Production-доменом стоит www.stariondigital.com, апекс на него
// редиректит. Раньше в метаданных был захардкожен starion-digital.com (через
// дефис, как называется проект в Vercel) — такого домена не существует, и все
// canonical/og:url вели в никуда.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.stariondigital.com'
).replace(/\/+$/, '');

export const SITE_NAME = 'Starion Digital';

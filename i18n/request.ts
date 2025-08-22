import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  // Читаем locale из cookie
  const locale = (await cookies()).get('locale')?.value || 'ru';

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

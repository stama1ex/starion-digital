// app/layout.tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { headers } from 'next/headers';
import { loadARExperienceBySlug } from '@/lib/ar/experience';
import { Header } from '@/components/shared/header';
import { Footer } from '@/components/shared/footer';
import { ThemeProvider } from '@/components/theme-provider';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { CookieBanner } from '@/components/ui/cookie-banner';
import { Toaster } from '@/components/ui/sonner';
import { PartnerProvider } from './providers/partner-provider';
import { ConfirmProvider } from './providers/confirm-provider';
import NextTopLoader from 'nextjs-toploader';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'HomePage' });

  return {
    title: `Starion Digital | ${t('meta.title')}`,
    description: t('meta.description'),
    // Иконка объявлена здесь, а не файлом app/favicon.ico: файловая конвенция
    // Next вставляет свой <link rel=icon> в обход metadata, и на странице
    // оживления с белой меткой рядом с нейтральной иконкой оказывалась наша.
    icons: { icon: '/favicon.ico' },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  let messages = await getMessages();

  // Страница оживления — полноэкранный вьюер: обвязка сайта на ней не видна,
  // но лежала бы в разметке, а при белой метке этого быть не должно.
  // Путь приходит из middleware — сюда он иначе не попадает.
  const pathname = (await headers()).get('x-pathname') || '';
  const bare = pathname.startsWith('/ar/');

  if (bare) {
    // NextIntlClientProvider сериализует переданный словарь прямо в HTML.
    // Вьюеру нужен только его собственный неймспейс: остальные тянут в
    // разметку весь сайт (это и лишние килобайты, и наше имя в открытую).
    // decodeURIComponent бросает URIError на битом percent-кодировании
    // (/ar/%), а это публичный маршрут — 500 здесь недопустим.
    const raw = pathname.split('/')[2] || '';
    let slug = '';
    try {
      slug = decodeURIComponent(raw);
    } catch {
      slug = raw;
    }
    const experience = slug ? await loadARExperienceBySlug(slug) : null;
    const viewer = { ...(messages.ARViewer as Record<string, unknown>) };

    if (experience?.whiteLabel) {
      // Единственные места в неймспейсе, где есть наше имя. Вьюер их при
      // белой метке не запрашивает, так что удалять безопасно: meta.* вообще
      // читается только в generateMetadata, то есть на сервере.
      delete viewer.poweredBy;
      delete viewer.meta;
      const cta = { ...(viewer.cta as Record<string, unknown>) };
      delete cta.catalog;
      viewer.cta = cta;
    }

    messages = { ARViewer: viewer } as typeof messages;
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextTopLoader
          color="oklch(0.5417 0.179 288.0332)"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #2563eb,0 0 5px #2563eb"
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <PartnerProvider>
              <ConfirmProvider>
                {!bare && <Header />}
                {children}
              </ConfirmProvider>
            </PartnerProvider>
            <Toaster />
            {!bare && (
              <>
                <Footer />
                <CookieBanner />
              </>
            )}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

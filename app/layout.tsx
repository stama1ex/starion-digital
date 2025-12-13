// app/layout.tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/shared/header';
import { Footer } from '@/components/shared/footer';
import { ThemeProvider } from '@/components/theme-provider';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { CookieBanner } from '@/components/ui/cookie-banner';
import { Toaster } from '@/components/ui/sonner';
import { PartnerProvider } from './providers/partner-provider';
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
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

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
              <Header />
              {children}
            </PartnerProvider>
            <Toaster />
            <Footer />
            <CookieBanner />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

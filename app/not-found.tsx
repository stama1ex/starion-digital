import { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Container } from '@/components/shared/container';
import NotFoundContent from '@/components/shared/not-found-content';

// Metadata generation (server-side)
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) ?? 'ru'; // Fallback to default if unresolved
  const t = await getTranslations({
    locale,
    namespace: 'NotFound',
  });
  return {
    title: `${t('title')} - Starion Digital`,
    description: t('description'),
    keywords: [
      'Starion Digital 404',
      'page not found',
      locale === 'ru'
        ? 'Страница не найдена'
        : locale === 'ro'
          ? 'Pagină negăsită'
          : 'Page not found',
    ],
    openGraph: {
      title: `${t('title')} - Starion Digital`,
      description: t('description'),
      url: `https://starion-digital.com/${locale}/404`,
      type: 'website',
      images: [
        {
          url: '/og-image-404.jpg',
          width: 1200,
          height: 630,
          alt: t('title'),
        },
      ],
    },
    alternates: {
      canonical: `https://starion-digital.com/${locale}/404`,
      languages: {
        ru: `https://starion-digital.com/ru/404`,
        en: `https://starion-digital.com/en/404`,
        ro: `https://starion-digital.com/ro/404`,
      },
    },
    other: {
      'application/ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: t('title'),
        description: t('description'),
        url: `https://starion-digital.com/${locale}/404`,
        publisher: {
          '@type': 'Organization',
          name: 'Starion Digital',
          url: 'https://starion-digital.com',
          logo: 'https://starion-digital.com/logo.png',
        },
      }),
    },
  };
}

export default async function NotFoundPage() {
  const locale = (await getLocale()) ?? 'ru'; // Fallback to default if unresolved
  const t = await getTranslations({
    locale,
    namespace: 'NotFound',
  });

  const translations = {
    title: t('title'),
    description: t('description'),
    home_button: t('home_button'),
  };

  return (
    <main className="min-h-screen flex items-center bg-background py-12 px-4 md:px-0">
      <Container className="max-w-4xl mx-auto text-center">
        <NotFoundContent translations={translations} />
      </Container>
    </main>
  );
}

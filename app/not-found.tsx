import { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { SITE_URL, SITE_NAME } from '@/lib/site';
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
      url: `${SITE_URL}/404`,
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
      canonical: `${SITE_URL}/404`,
    },
    other: {
      'application/ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: t('title'),
        description: t('description'),
        url: `${SITE_URL}/404`,
        publisher: {
          '@type': 'Organization',
          name: SITE_NAME,
          url: SITE_URL,
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

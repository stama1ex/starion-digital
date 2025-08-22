// app/page.tsx
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/shared/container';
import HomeContent from './home-content';

// Metadata generation (server-side)
export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'HomePage',
  });
  return {
    title: `${t('meta.title')} | Starion Digital`,
    description: t('meta.description'),
    keywords: [
      'augmented reality souvenirs',
      'AR souvenirs',
      'Starion Digital',
      'custom souvenirs',
    ],
    openGraph: {
      title: `${t('meta.title')} | Starion Digital`,
      description: t('meta.description'),
      url: `https://starion-digital.com/${params.locale}`,
      images: [{ url: '/og-image-home.jpg', width: 1200, height: 630 }],
    },
    alternates: {
      canonical: `https://starion-digital.com/${params.locale}`,
      languages: {
        ru: `https://starion-digital.com/ru`,
        en: `https://starion-digital.com/en`,
        ro: `https://starion-digital.com/ro`,
      },
    },
    other: {
      'application/ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Starion Digital',
        url: 'https://starion-digital.com',
        logo: 'https://starion-digital.com/logo.png',
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: '+373 680 33 007',
          contactType: 'Customer Service',
          email: 'stamat2000@gmail.com',
        },
      }),
    },
  };
}

// Server component
export default async function Page({ params }: { params: { locale: string } }) {
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'HomePage',
  });

  // Pass translations to client component
  const translations = {
    title: t('title'),
    description: t('description'),
  };

  return (
    <main className="min-h-screen flex items-center bg-background mx-4 md:mx-0">
      <Container>
        <HomeContent translations={translations} />
      </Container>
    </main>
  );
}

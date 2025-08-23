// app/page.tsx
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/shared/container';
import HomeContent from './home-content';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params; // 👈 деструктурируем из промиса
  const t = await getTranslations({
    locale,
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
      url: `https://starion-digital.com/${locale}`,
      images: [{ url: '/og-image-home.jpg', width: 1200, height: 630 }],
    },
    alternates: {
      canonical: `https://starion-digital.com/${locale}`,
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

export default async function Page({ params }: PageProps) {
  const { locale } = await params; // 👈 ждём промис
  const t = await getTranslations({
    locale,
    namespace: 'HomePage',
  });

  const translations = {
    title: t('title'),
    description: t('description'),
    choose: t('choose'),
    categories: t.raw('categories') as string[],
  };

  return (
    <main className="min-h-screen flex items-center bg-background mx-4 md:mx-0">
      <Container>
        <HomeContent translations={translations} />
      </Container>
    </main>
  );
}

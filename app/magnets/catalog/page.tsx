// app/magnets/catalog/page.tsx
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import MagnetsCatalogContent from './magnets-catalog-content';

type PageProps = {
  params: Promise<{ locale: string }>; // 👈 асинхронный params
};

// Metadata generation (server-side)
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params; // 👈 деструктурируем из промиса
  const t = await getTranslations({
    locale,
    namespace: 'Catalog',
  });

  return {
    title: `${t('magnets_title')} - Starion Digital`,
    description: t('meta.description'),
    keywords: [
      'AR magnets',
      'souvenir magnets',
      'Starion Digital magnets',
      'augmented reality souvenirs',
      locale === 'ru'
        ? 'Магниты с дополненной реальностью'
        : locale === 'ro'
          ? 'Magnete AR'
          : 'AR magnets',
    ],
    openGraph: {
      title: `${t('magnets_title')} - Starion Digital`,
      description: t('meta.description'),
      url: `https://starion-digital.com/${locale}/magnets/catalog`,
      images: [{ url: '/magnets/01.avif', width: 500, height: 500 }],
    },
    alternates: {
      canonical: `https://starion-digital.com/${locale}/magnets/catalog`,
      languages: {
        ru: `https://starion-digital.com/ru/magnets/catalog`,
        en: `https://starion-digital.com/en/magnets/catalog`,
        ro: `https://starion-digital.com/ro/magnets/catalog`,
      },
    },
    other: {
      'application/ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ProductGroup',
        name: 'AR Magnets',
        description: t('meta.description'),
        url: `https://starion-digital.com/${locale}/magnets/catalog`,
      }),
    },
  };
}

export default async function MagnetsCatalogPage({ params }: PageProps) {
  const { locale } = await params; // 👈 тоже await
  const t = await getTranslations({
    locale,
    namespace: 'Catalog',
  });

  const translations = {
    magnets_title: t('magnets_title'),
  };

  // Fetch product data server-side
  const products = (await import('../../../public/magnets.json')).default;

  return (
    <main>
      <MagnetsCatalogContent
        translations={translations}
        dataSource="/magnets.json"
        exampleProductNumber="45"
        products={products}
      />
    </main>
  );
}

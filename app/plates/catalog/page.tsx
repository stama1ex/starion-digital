// app/plates/catalog/page.tsx
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import PlatesCatalogContent from './plates-catalog-content';

// Metadata generation (server-side)
export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'Catalog',
  });
  return {
    title: `${t('plates_title')} - Starion Digital`,
    description: t('meta.description_plates'),
    keywords: [
      'AR plates',
      'souvenir plates',
      'Starion Digital plates',
      'augmented reality souvenirs',
      params.locale === 'ru'
        ? 'Тарелки с дополненной реальностью'
        : params.locale === 'ro'
          ? 'Farfurii AR'
          : 'AR plates',
    ],
    openGraph: {
      title: `${t('plates_title')} - Starion Digital`,
      description: t('meta.description_plates'),
      url: `https://starion-digital.com/${params.locale}/plates/catalog`,
      images: [{ url: '/plates/110.avif', width: 500, height: 500 }],
    },
    alternates: {
      canonical: `https://starion-digital.com/${params.locale}/plates/catalog`,
      languages: {
        ru: `https://starion-digital.com/ru/plates/catalog`,
        en: `https://starion-digital.com/en/plates/catalog`,
        ro: `https://starion-digital.com/ro/plates/catalog`,
      },
    },
    other: {
      'application/ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ProductGroup',
        name: 'AR Plates',
        description: t('meta.description_plates'),
        url: `https://starion-digital.com/${params.locale}/plates/catalog`,
      }),
    },
  };
}

export default async function PlatesCatalogPage({
  params,
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'Catalog',
  });

  const translations = {
    plates_title: t('plates_title'),
  };

  // Fetch product data server-side
  const products = (await import('../../../public/plates.json')).default;

  return (
    <main>
      <PlatesCatalogContent
        translations={translations}
        dataSource="/plates.json"
        exampleProductNumber="112"
        products={products}
      />
    </main>
  );
}

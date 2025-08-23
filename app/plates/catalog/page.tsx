import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import PlatesCatalogContent from './plates-catalog-content';

// Define the params type explicitly
interface PageParams {
  locale: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>; // Use Promise<PageParams>
}): Promise<Metadata> {
  const resolvedParams = await params; // Await the Promise
  const t = await getTranslations({
    locale: resolvedParams.locale,
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
      resolvedParams.locale === 'ru'
        ? 'Тарелки с дополненной реальностью'
        : resolvedParams.locale === 'ro'
          ? 'Farfurii AR'
          : 'AR plates',
    ],
    openGraph: {
      title: `${t('plates_title')} - Starion Digital`,
      description: t('meta.description_plates'),
      url: `https://starion-digital.com/${resolvedParams.locale}/plates/catalog`,
      images: [{ url: '/plates/110.avif', width: 500, height: 500 }],
    },
    alternates: {
      canonical: `https://starion-digital.com/${resolvedParams.locale}/plates/catalog`,
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
        url: `https://starion-digital.com/${resolvedParams.locale}/plates/catalog`,
      }),
    },
  };
}

export default async function PlatesCatalogPage({
  params,
}: {
  params: Promise<PageParams>; // Use Promise<PageParams>
}) {
  const resolvedParams = await params;
  const t = await getTranslations({
    locale: resolvedParams.locale,
    namespace: 'Catalog',
  });

  const translations = {
    plates_title: t('plates_title'),
  };

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

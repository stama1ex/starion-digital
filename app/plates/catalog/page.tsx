/* eslint-disable @typescript-eslint/no-explicit-any */
import { Dropbox } from 'dropbox';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import PlatesCatalogContent from './plates-catalog-content';
import { Souvenir } from '@/types';
import fetch from 'node-fetch'; // Import node-fetch
import fs from 'fs/promises';
import path from 'path';
import { getAccessToken } from '@/lib/dropbox';

interface PageParams {
  locale: string;
}

async function getModelUrl(fileName: string) {
  try {
    const accessToken = await getAccessToken();

    const dbx = new Dropbox({
      accessToken,
      fetch: fetch as any,
    });

    const { result } = await dbx.filesGetTemporaryLink({
      path: `/${fileName}`,
    });

    return result.link;
  } catch (error) {
    console.error(`Error fetching Dropbox link for ${fileName}:`, error);
    return '';
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const resolvedParams = await params;
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
  params: Promise<PageParams>;
}) {
  const resolvedParams = await params;
  const t = await getTranslations({
    locale: resolvedParams.locale,
    namespace: 'Catalog',
  });

  const translations = {
    plates_title: t('plates_title'),
  };

  // Fetch product data server-side
  let products: Souvenir[] = [];
  try {
    const filePath = path.join(process.cwd(), 'public', 'plates.json');
    const fileContent = await fs.readFile(filePath, 'utf-8');
    products = JSON.parse(fileContent) as Souvenir[];
  } catch (error) {
    console.error('Error reading plates.json:', error);
    products = []; // Fallback to empty array
  }

  // Fetch Dropbox URLs
  const modelUrls = {
    magnet: await getModelUrl('magnet.glb'),
    plate: await getModelUrl('plate.glb'),
  };

  return (
    <main>
      <PlatesCatalogContent
        translations={translations}
        dataSource="/plates.json"
        exampleProductNumber="112"
        products={products}
        modelUrls={modelUrls}
      />
    </main>
  );
}

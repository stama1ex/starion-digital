/* eslint-disable @typescript-eslint/no-explicit-any */
import { Dropbox } from 'dropbox';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import MagnetsCatalogContent from './magnets-catalog-content';
import { Souvenir } from '@/types';
import fetch from 'node-fetch'; // Import node-fetch
import fs from 'fs/promises';
import path from 'path';
import { getAccessToken } from '@/lib/dropbox';

type PageProps = {
  params: Promise<{ locale: string }>;
};

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
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
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
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: 'Catalog',
  });

  const translations = {
    magnets_title: t('magnets_title'),
  };

  // Fetch product data server-side
  let products: Souvenir[] = [];
  try {
    const filePath = path.join(process.cwd(), 'public', 'magnets.json');
    const fileContent = await fs.readFile(filePath, 'utf-8');
    products = JSON.parse(fileContent) as Souvenir[];
  } catch (error) {
    console.error('Error reading magnets.json:', error);
    products = []; // Fallback to empty array
  }

  // Fetch Dropbox URLs
  const modelUrls = {
    magnet: await getModelUrl('magnet.glb'),
    plate: await getModelUrl('plate.glb'),
  };

  return (
    <main>
      <MagnetsCatalogContent
        translations={translations}
        dataSource="/magnets.json"
        exampleProductNumber="45"
        products={products}
        modelUrls={modelUrls}
      />
    </main>
  );
}

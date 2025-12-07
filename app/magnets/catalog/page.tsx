/* eslint-disable @typescript-eslint/no-explicit-any */
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { getModelUrl } from '@/lib/models';
import { cookies } from 'next/headers';
import MagnetsCatalogContent from './magnets-catalog-content';

type PageProps = {
  params: Promise<{ locale: string }>;
};

// --- SEO ---
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Catalog' });

  return {
    title: `${t('magnets_title')} - Starion Digital`,
    description: t('meta.description'),
  };
}

// --- PAGE ---
export default async function MagnetsCatalogPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Catalog' });

  // Получаем товары
  const products = await prisma.product.findMany({
    where: { type: 'MAGNET' },
    orderBy: { number: 'asc' },
  });

  // Загружаем цены партнёра
  const session = (await cookies()).get('session')?.value;
  let prices: any[] = [];
  if (session) {
    prices = await prisma.price.findMany({
      where: { partnerId: parseInt(session) },
      select: { type: true, material: true, price: true },
    });
  }

  // Dropbox модели
  const modelUrls = {
    magnet: await getModelUrl('magnet.glb'),
    plate: await getModelUrl('plate.glb'),
  };

  return (
    <main className="min-h-screen bg-background">
      <MagnetsCatalogContent
        translations={{ magnets_title: t('magnets_title') }}
        products={products}
        modelUrls={modelUrls}
        exampleProductNumber={products[0]?.number}
        prices={prices}
      />
    </main>
  );
}

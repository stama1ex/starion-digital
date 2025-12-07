/* eslint-disable @typescript-eslint/no-explicit-any */
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { getModelUrl } from '@/lib/models';
import { cookies } from 'next/headers';
import MagnetsCatalogContent from './magnets-catalog-content';
import type { ProductType, Material } from '@prisma/client';

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

  // Загружаем цены партнёра, если вошёл
  const session = (await cookies()).get('session')?.value;
  let prices: { type: ProductType; material: Material; price: number }[] = [];

  if (session) {
    const raw = await prisma.price.findMany({
      where: { partnerId: parseInt(session) },
      select: { type: true, material: true, price: true },
    });

    prices = raw.map((p) => ({
      type: p.type as ProductType,
      material: p.material as Material,
      price: Number(p.price),
    }));
  }

  // Dropbox модели
  const modelUrls = {
    magnet: await getModelUrl('magnet.glb'),
    plate: await getModelUrl('plate.glb'),
  };

  return (
    <main className="min-h-screen bg-background">
      <MagnetsCatalogContent
        products={products}
        modelUrls={modelUrls}
        exampleProductNumber={products[0]?.number}
        prices={prices}
      />
    </main>
  );
}

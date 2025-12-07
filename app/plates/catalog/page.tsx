/* eslint-disable @typescript-eslint/no-explicit-any */
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { getModelUrl } from '@/lib/models';
import { cookies } from 'next/headers';
import PlatesCatalogContent from './plates-catalog-content';
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
    title: `${t('plates_title')} - Starion Digital`,
    description: t('meta.description_plates'),
  };
}

// --- PAGE ---
export default async function PlatesCatalogPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Catalog' });

  // Получаем товары
  const products = await prisma.product.findMany({
    where: { type: 'PLATE' },
    orderBy: { number: 'asc' },
  });

  // Загружаем цены партнёра
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
      <PlatesCatalogContent
        products={products}
        modelUrls={modelUrls}
        exampleProductNumber={products[0]?.number}
        prices={prices}
      />
    </main>
  );
}

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { getModelUrl } from '@/lib/models';
import { cookies } from 'next/headers';
import MagnetsCatalogContent from './magnets-catalog-content';
import type { ProductType, Material } from '@prisma/client';

// --- SEO ---
export async function generateMetadata({ params }: any): Promise<Metadata> {
  const locale = (await params).locale;
  const t = await getTranslations({ locale, namespace: 'Catalog' });

  return {
    title: `${t('magnets_title')} - Starion Digital`,
    description: t('meta.description'),
  };
}

// --- PAGE ---
export default async function MagnetsCatalogPage({ params }: any) {
  const products = await prisma.product.findMany({
    where: { type: 'MAGNET' },
    orderBy: { number: 'asc' },
  });

  const session = (await cookies()).get('session')?.value;
  let prices: { type: ProductType; material: Material; price: number }[] = [];

  if (session) {
    const raw = await prisma.price.findMany({
      where: { partnerId: parseInt(session) },
      select: { type: true, material: true, price: true },
    });

    prices = raw.map((p) => ({
      type: p.type,
      material: p.material,
      price: Number(p.price),
    }));
  }

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

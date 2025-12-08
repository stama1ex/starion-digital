/* eslint-disable @typescript-eslint/no-explicit-any */
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { getModelUrl } from '@/lib/models';
import { cookies } from 'next/headers';
import MagnetsCatalogContent from './magnets-catalog-content';

export async function generateMetadata({ params }: any): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'Catalog' });

  return {
    title: `${t('magnets_title')} - Starion Digital`,
    description: t('meta.description'),
  };
}

export default async function MagnetsCatalogPage({ params }: any) {
  const locale = params.locale;
  await getTranslations({ locale, namespace: 'Catalog' });

  const products = await prisma.product.findMany({
    where: { type: 'MAGNET' },
    orderBy: { number: 'asc' },
  });

  const session = (await cookies()).get('session')?.value;
  let prices: {
    type: 'MAGNET' | 'PLATE';
    material: 'MARBLE' | 'WOOD' | 'ACRYLIC';
    price: number;
  }[] = [];

  if (session) {
    const partnerId = Number(session);
    const raw = await prisma.price.findMany({
      where: { partnerId },
      select: { type: true, material: true, price: true },
    });

    prices = raw.map((p: { type: string; material: string; price: any }) => ({
      type: p.type as 'MAGNET' | 'PLATE',
      material: p.material as 'MARBLE' | 'WOOD' | 'ACRYLIC',
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

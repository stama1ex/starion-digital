/* eslint-disable @typescript-eslint/no-explicit-any */
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { getModelUrl } from '@/lib/models';
import { cookies } from 'next/headers';
import PlatesCatalogContent from './plates-catalog-content';
import { toPlain } from '@/lib/toPlain';

export async function generateMetadata({ params }: any): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'Catalog' });

  return {
    title: `${t('plates_title')} - Starion Digital`,
    description: t('meta.description_plates'),
  };
}

export default async function PlatesCatalogPage({ params }: any) {
  const locale = params.locale;
  await getTranslations({ locale, namespace: 'Catalog' });

  // ❗ Берём товары с материалами
  const rawProducts = await prisma.product.findMany({
    where: { type: 'PLATE' },
    orderBy: { number: 'asc' },
    include: { material: true },
  });

  // ❗ Удаляем Decimal и добавляем material name
  const products = toPlain(rawProducts).map((p: any) => ({
    ...p,
    material: p.material.name,
  }));

  // --- ценообразование ---
  const session = (await cookies()).get('session')?.value;
  let prices: {
    type: 'MAGNET' | 'PLATE';
    material: string;
    price: number;
  }[] = [];

  if (session) {
    const partnerId = Number(session);
    const raw = await prisma.price.findMany({
      where: { partnerId },
      include: { material: true },
    });

    prices = raw.map((p) => ({
      type: p.type as 'MAGNET' | 'PLATE',
      material: p.material.name,
      price: Number(p.price),
    }));
  }

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

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

  // ❗ Берём товары
  const rawProducts = await prisma.product.findMany({
    where: { type: 'PLATE' },
    orderBy: { number: 'asc' },
  });

  // ❗ Удаляем Decimal
  const products = toPlain(rawProducts);

  // --- ценообразование ---
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

    prices = raw.map((p) => ({
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
      <PlatesCatalogContent
        products={products}
        modelUrls={modelUrls}
        exampleProductNumber={products[0]?.number}
        prices={prices}
      />
    </main>
  );
}

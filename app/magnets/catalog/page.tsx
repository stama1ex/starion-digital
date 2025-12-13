/* eslint-disable @typescript-eslint/no-explicit-any */
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { getModelUrl } from '@/lib/models';
import { cookies } from 'next/headers';
import MagnetsCatalogContent from './magnets-catalog-content';
import { toPlain } from '@/lib/toPlain';

// Revalidate every 5 minutes
export const revalidate = 300;

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

  // ❗ Берём товары с группами
  const rawProducts = await prisma.product.findMany({
    where: { type: 'MAGNET' },
    orderBy: { number: 'asc' },
    include: { group: true },
  });

  // ❗ Удаляем Decimal
  const products = toPlain(rawProducts);

  // --- ценообразование ---
  const session = (await cookies()).get('session')?.value;
  let prices: {
    type: 'MAGNET' | 'PLATE';
    group: { id: number; slug: string; translations: any } | null;
    price: number;
  }[] = [];

  if (session) {
    const partnerId = Number(session);
    const raw = await prisma.price.findMany({
      where: { partnerId },
      include: { group: true },
    });

    prices = raw.map((p) => ({
      type: p.type as 'MAGNET' | 'PLATE',
      group: p.group
        ? {
            id: p.group.id,
            slug: p.group.slug,
            translations: p.group.translations,
          }
        : null,
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

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import CardsCatalogContent from './cards-catalog-content';
import { toPlain } from '@/lib/toPlain';
import { getPartnerFromSessionCookie } from '@/lib/auth/session';
import { resolveProductImages } from '@/lib/resolveProductImages';

// Revalidate every 5 minutes
export const revalidate = 300;

export async function generateMetadata({ params }: any): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'Catalog' });

  return {
    title: `${t('cards_title')} - Starion Digital`,
    description: t('meta.description_cards'),
  };
}

export default async function CardsCatalogPage({ params }: any) {
  const locale = params.locale;
  await getTranslations({ locale, namespace: 'Catalog' });

  const rawProducts = await prisma.product.findMany({
    where: { type: 'POSTCARD', isHidden: false },
    orderBy: { number: 'asc' },
    include: { group: true },
  });

  const plainProducts = toPlain(rawProducts);

  // Резолвим Dropbox-картинки одним батчем на сервере, чтобы каталог не
  // дёргал /api/dropbox/temp-link на каждую карточку отдельно с клиента
  const products = await resolveProductImages(plainProducts);

  let prices: {
    type: string;
    group: { id: number; slug: string; translations: any } | null;
    price: number;
  }[] = [];

  const partner = await getPartnerFromSessionCookie();

  if (partner) {
    const partnerId = partner.id;
    const raw = await prisma.price.findMany({
      where: { partnerId },
      include: { group: true },
    });

    prices = raw.map((p) => ({
      type: p.type as string,
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

  return (
    <main className="min-h-screen bg-background">
      <CardsCatalogContent products={products} modelUrls={{}} prices={prices} />
    </main>
  );
}

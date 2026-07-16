/* eslint-disable @typescript-eslint/no-explicit-any */
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { toPlain } from '@/lib/toPlain';
import { getPartnerFromSessionCookie } from '@/lib/auth/session';
import { resolveProductImages } from '@/lib/resolveProductImages';
import KeychainsCatalogContent from './keychains-catalog-content';

export const revalidate = 300;

export async function generateMetadata({ params }: any): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'Catalog' });

  return {
    title: `${t('keychains_title')} - Starion Digital`,
    description: t('meta.description_keychains'),
  };
}

export default async function KeychainsCatalogPage({ params }: any) {
  const locale = params.locale;
  await getTranslations({ locale, namespace: 'Catalog' });

  const rawProducts = await prisma.product.findMany({
    where: { type: 'KEYCHAIN', isHidden: false },
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
    const raw = await prisma.price.findMany({
      where: { partnerId: partner.id },
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
      <KeychainsCatalogContent
        products={products}
        modelUrls={{}}
        prices={prices}
      />
    </main>
  );
}

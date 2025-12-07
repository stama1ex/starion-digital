/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Catalog from '@/components/shared/catalog';
import { Product } from '@prisma/client';

interface MagnetsCatalogContentProps {
  translations: { magnets_title: string };
  exampleProductNumber: string;
  products: Product[];
  modelUrls: Record<string, string>;
  prices: {
    type: Product['type'];
    material: Product['material'];
    price: number;
  }[];
}

export default function MagnetsCatalogContent({
  translations,
  exampleProductNumber,
  products,
  modelUrls,
  prices,
}: MagnetsCatalogContentProps) {
  return (
    <Catalog
      title={translations.magnets_title}
      exampleProductNumber={exampleProductNumber}
      products={products}
      modelUrls={modelUrls}
      prices={prices}
    />
  );
}

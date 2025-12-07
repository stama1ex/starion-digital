/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Catalog from '@/components/shared/catalog';
import { Product } from '@prisma/client';

interface PlatesCatalogContentProps {
  translations: { plates_title: string };
  exampleProductNumber: string;
  products: Product[];
  modelUrls: Record<string, string>;
  prices: {
    type: Product['type'];
    material: Product['material'];
    price: number;
  }[];
}

export default function PlatesCatalogContent({
  translations,
  exampleProductNumber,
  products,
  modelUrls,
  prices,
}: PlatesCatalogContentProps) {
  return (
    <Catalog
      title={translations.plates_title}
      exampleProductNumber={exampleProductNumber}
      products={products}
      modelUrls={modelUrls}
      prices={prices}
    />
  );
}

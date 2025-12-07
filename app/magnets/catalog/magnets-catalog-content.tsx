/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Catalog from '@/components/shared/catalog';
import { Product, ProductType, Material } from '@prisma/client';

interface MagnetsCatalogContentProps {
  exampleProductNumber: string;
  products: Product[];
  modelUrls: Record<string, string>;
  prices: {
    type: ProductType;
    material: Material;
    price: number;
  }[];
}

export default function MagnetsCatalogContent({
  exampleProductNumber,
  products,
  modelUrls,
  prices,
}: MagnetsCatalogContentProps) {
  return (
    <Catalog
      titleKey="magnets_title"
      exampleProductNumber={exampleProductNumber}
      products={products}
      modelUrls={modelUrls}
      prices={prices}
    />
  );
}

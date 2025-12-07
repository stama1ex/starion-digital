/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Catalog from '@/components/shared/catalog';
import { Product, ProductType, Material } from '@prisma/client';

interface PlatesCatalogContentProps {
  exampleProductNumber: string;
  products: Product[];
  modelUrls: Record<string, string>;
  prices: {
    type: ProductType;
    material: Material;
    price: number;
  }[];
}

export default function PlatesCatalogContent({
  exampleProductNumber,
  products,
  modelUrls,
  prices,
}: PlatesCatalogContentProps) {
  return (
    <Catalog
      titleKey="plates_title"
      exampleProductNumber={exampleProductNumber}
      products={products}
      modelUrls={modelUrls}
      prices={prices}
    />
  );
}

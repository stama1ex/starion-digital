'use client';

import Catalog from '@/components/shared/catalog';
import type { ProductType, Material } from '@prisma/client';

interface MagnetProductDTO {
  id: number;
  number: string;
  type: ProductType;
  material: Material;
  image: string;
  country: string;
}

interface MagnetsCatalogContentProps {
  exampleProductNumber: string;
  products: MagnetProductDTO[];
  modelUrls: Record<string, string>;
  prices?: {
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

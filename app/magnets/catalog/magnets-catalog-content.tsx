'use client';

import Catalog from '@/components/shared/catalog';
import type { $Enums } from '@prisma/client';

interface MagnetProductDTO {
  id: number;
  number: string;
  type: $Enums.ProductType;
  material: $Enums.Material;
  image: string;
  country: string;
}

interface MagnetsCatalogContentProps {
  exampleProductNumber: string;
  products: MagnetProductDTO[];
  modelUrls: Record<string, string>;
  prices?: {
    type: $Enums.ProductType;
    material: $Enums.Material;
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

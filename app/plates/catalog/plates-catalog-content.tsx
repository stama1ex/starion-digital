'use client';

import Catalog from '@/components/shared/catalog';
import type { $Enums } from '@prisma/client';

interface PlateProductDTO {
  id: number;
  number: string;
  type: $Enums.ProductType;
  material: $Enums.Material;
  image: string;
  country: string;
}

interface PlatesCatalogContentProps {
  exampleProductNumber: string;
  products: PlateProductDTO[];
  modelUrls: Record<string, string>;
  prices?: {
    type: $Enums.ProductType;
    material: $Enums.Material;
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

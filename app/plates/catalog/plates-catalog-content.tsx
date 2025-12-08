'use client';

import Catalog from '@/components/shared/catalog';
import type { ProductType, Material } from '@prisma/client';

// DTO для товаров
interface PlateProductDTO {
  id: number;
  number: string;
  type: ProductType;
  material: Material;
  image: string;
  country: string;
}

interface PlatesCatalogContentProps {
  exampleProductNumber: string;
  products: PlateProductDTO[];
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

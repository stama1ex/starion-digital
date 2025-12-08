'use client';

import Catalog from '@/components/shared/catalog';

interface PlateProductDTO {
  id: number;
  number: string;
  type: string;
  material: string;
  image: string;
  country: string;
}

interface PlatesCatalogContentProps {
  exampleProductNumber: string;
  products: PlateProductDTO[];
  modelUrls: Record<string, string>;
  prices?: {
    type: string;
    material: string;
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

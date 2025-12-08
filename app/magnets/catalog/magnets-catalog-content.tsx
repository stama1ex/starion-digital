'use client';

import Catalog from '@/components/shared/catalog';

interface MagnetProductDTO {
  id: number;
  number: string;
  type: string;
  material: string;
  image: string;
  country: string;
}

interface MagnetsCatalogContentProps {
  exampleProductNumber: string;
  products: MagnetProductDTO[];
  modelUrls: Record<string, string>;
  prices?: {
    type: string;
    material: string;
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

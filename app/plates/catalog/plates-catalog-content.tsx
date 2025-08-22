// components/PlatesCatalogContent.tsx
'use client';

import Catalog from '@/components/shared/catalog';
import { Souvenir } from '@/types';

interface PlatesCatalogContentProps {
  translations: {
    plates_title: string;
  };
  dataSource: string;
  exampleProductNumber: string;
  products: Souvenir[];
}

export default function PlatesCatalogContent({
  translations,
  dataSource,
  exampleProductNumber,
  products,
}: PlatesCatalogContentProps) {
  return (
    <Catalog
      title={translations.plates_title}
      dataSource={dataSource}
      exampleProductNumber={exampleProductNumber}
      products={products}
    />
  );
}

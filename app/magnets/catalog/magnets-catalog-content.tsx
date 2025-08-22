// components/MagnetsCatalogContent.tsx
'use client';

import Catalog from '@/components/shared/catalog';
import { Souvenir } from '@/types';

interface MagnetsCatalogContentProps {
  translations: {
    magnets_title: string;
  };
  dataSource: string;
  exampleProductNumber: string;
  products: Souvenir[];
}

export default function MagnetsCatalogContent({
  translations,
  dataSource,
  exampleProductNumber,
  products,
}: MagnetsCatalogContentProps) {
  return (
    <Catalog
      title={translations.magnets_title}
      dataSource={dataSource}
      exampleProductNumber={exampleProductNumber}
      products={products}
    />
  );
}

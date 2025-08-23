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
  modelUrls: Record<string, string>; // New prop for Dropbox URLs
}

export default function PlatesCatalogContent({
  translations,
  dataSource,
  exampleProductNumber,
  products,
  modelUrls, // Receive Dropbox URLs
}: PlatesCatalogContentProps) {
  return (
    <Catalog
      title={translations.plates_title}
      dataSource={dataSource}
      exampleProductNumber={exampleProductNumber}
      products={products}
      modelUrls={modelUrls} // Pass modelUrls to Catalog
    />
  );
}

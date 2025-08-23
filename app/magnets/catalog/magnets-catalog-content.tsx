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
  modelUrls: Record<string, string>; // New prop for Dropbox URLs
}

export default function MagnetsCatalogContent({
  translations,
  dataSource,
  exampleProductNumber,
  products,
  modelUrls, // Receive Dropbox URLs
}: MagnetsCatalogContentProps) {
  return (
    <Catalog
      title={translations.magnets_title}
      dataSource={dataSource}
      exampleProductNumber={exampleProductNumber}
      products={products}
      modelUrls={modelUrls} // Pass modelUrls to Catalog
    />
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Catalog from '@/components/shared/catalog';
import CatalogTabs from '@/components/shared/catalog-tabs';
import { Container } from '@/components/shared/container';
import CategoryPagination from '@/components/shared/category-pagination';

interface KeychainProductDTO {
  id: number;
  number: string;
  type: string;
  group?: {
    id: number;
    slug: string;
    translations: any;
  } | null;
  image: string;
  country: string;
}

interface KeychainsCatalogContentProps {
  products: KeychainProductDTO[];
  modelUrls: Record<string, string>;
  prices?: {
    type: string;
    group: {
      id: number;
      slug: string;
      translations: any;
    } | null;
    price: number;
  }[];
}

export default function KeychainsCatalogContent({
  products,
  modelUrls,
  prices,
}: KeychainsCatalogContentProps) {
  const uniqueGroups = products
    .map((p) => p.group)
    .filter((g): g is NonNullable<typeof g> => !!g)
    .filter(
      (group, index, self) =>
        self.findIndex((g) => g.id === group.id) === index,
    );

  if (uniqueGroups.length === 0) {
    return (
      <>
        <Catalog
          titleKey="keychains_title"
          products={products}
          modelUrls={modelUrls}
          prices={prices}
        />
        <CategoryPagination current="keychain" />
      </>
    );
  }

  return (
    <>
      <Container>
        <CatalogTabs
          titleKey="keychains_title"
          products={products}
          modelUrls={modelUrls}
          prices={prices}
        />
      </Container>
      <CategoryPagination current="keychain" />
    </>
  );
}

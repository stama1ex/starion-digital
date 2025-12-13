/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Catalog from '@/components/shared/catalog';
import CatalogTabs from '@/components/shared/catalog-tabs';
import ExampleBlock from '@/components/shared/example-block';
import { Container } from '@/components/shared/container';

interface PlateProductDTO {
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

interface PlatesCatalogContentProps {
  exampleProductNumber?: string;
  products: PlateProductDTO[];
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

export default function PlatesCatalogContent({
  exampleProductNumber,
  products,
  modelUrls,
  prices,
}: PlatesCatalogContentProps) {
  // Получаем уникальные группы
  const uniqueGroups = products
    .map((p) => p.group)
    .filter((g): g is NonNullable<typeof g> => !!g)
    .filter(
      (group, index, self) => self.findIndex((g) => g.id === group.id) === index
    );

  // Находим пример товара
  const exampleProduct = exampleProductNumber
    ? products.find((p) => p.number === exampleProductNumber)
    : products[0];

  // Если нет групп, показываем обычный каталог
  if (uniqueGroups.length === 0) {
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

  return (
    <Container>
      {/* ExampleBlock отображается над табами */}
      {exampleProduct && (
        <ExampleBlock
          souvenir={{
            number: exampleProduct.number,
            image: exampleProduct.image,
            country: exampleProduct.country,
            type: exampleProduct.type.toLowerCase(),
          }}
          reverse={false}
          className="my-6 md:my-12"
          modelUrl={modelUrls[exampleProduct.type.toLowerCase()] || ''}
        />
      )}

      <hr className="my-12" />

      <CatalogTabs
        titleKey="plates_title"
        products={products}
        modelUrls={modelUrls}
        prices={prices}
      />
    </Container>
  );
}

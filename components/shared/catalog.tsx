/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { memo, useCallback, useMemo } from 'react';
import { Container } from '@/components/shared/container';
import { Title } from '@/components/shared/title';
import ExampleBlock from '@/components/shared/example-block';
import { useTranslations } from 'next-intl';
import { ProductCard } from './product-card';

// Типы такие же, как в Prisma
type ProductType = string;

interface ProductDTO {
  id: number;
  number: string;
  type: ProductType;
  group?: {
    id: number;
    slug: string;
    translations: any;
  } | null;
  image: string;
  country: string;
}

interface CatalogProps {
  titleKey: string;
  exampleProductNumber?: string;
  className?: string;
  products: ProductDTO[];
  modelUrls: Record<string, string>;
  prices?: {
    type: ProductType;
    group: {
      id: number;
      slug: string;
      translations: any;
    } | null;
    price: number;
  }[];
  hideTitle?: boolean;
}

const CatalogImpl: React.FC<CatalogProps> = ({
  titleKey,
  exampleProductNumber,
  className,
  products,
  modelUrls,
  prices,
  hideTitle = false,
}) => {
  const t = useTranslations('Catalog');

  const exampleProduct = exampleProductNumber
    ? products.find((p) => p.number === exampleProductNumber) || null
    : null;

  const getPrice = useCallback(
    (p: ProductDTO) => {
      if (!prices) return null;
      const match = prices.find(
        (x) => x.type === p.type && x.group?.id === p.group?.id,
      );
      return match?.price ?? null;
    },
    [prices],
  );

  // Уникальные группы + товары по группам одним проходом, вместо
  // отдельного .filter() по всему списку на каждую группу
  const { uniqueGroups, groupedProducts, ungroupedProducts } = useMemo(() => {
    const seen = new Set<number>();
    const groups: NonNullable<ProductDTO['group']>[] = [];
    const byGroup = new Map<number, ProductDTO[]>();
    const ungrouped: ProductDTO[] = [];

    for (const p of products) {
      if (p.group) {
        if (!seen.has(p.group.id)) {
          seen.add(p.group.id);
          groups.push(p.group);
        }
        const list = byGroup.get(p.group.id);
        if (list) {
          list.push(p);
        } else {
          byGroup.set(p.group.id, [p]);
        }
      } else {
        ungrouped.push(p);
      }
    }

    groups.sort((a, b) => a.id - b.id);

    return {
      uniqueGroups: groups,
      groupedProducts: byGroup,
      ungroupedProducts: ungrouped,
    };
  }, [products]);

  return (
    <div className={className}>
      <Container>
        {exampleProduct && (
          <ExampleBlock
            key={exampleProduct.id}
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

        {!hideTitle && (
          <>
            <div className="flex justify-center w-full h-full">
              <Title
                text={t(titleKey)}
                className="my-6! text-[28px] md:text-6xl font-extrabold leading-tight animate-gradient-flow text-center"
              />
            </div>
          </>
        )}

        {/* Товары по группам */}
        {uniqueGroups.map((group) => {
          const groupProducts = groupedProducts.get(group.id) ?? [];
          return (
            <div key={group.id}>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 px-4 md:px-0">
                {groupProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    getPrice={getPrice}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Товары без группы */}
        {ungroupedProducts.length > 0 && (
          <div>
            {/* <h2 className="text-xl md:text-3xl font-bold mb-4 text-center md:text-start">
              Другие товары
            </h2> */}

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 px-4 md:px-0">
              {ungroupedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  getPrice={getPrice}
                />
              ))}
            </div>
          </div>
        )}
      </Container>
    </div>
  );
};

const Catalog = memo(CatalogImpl);

export default Catalog;

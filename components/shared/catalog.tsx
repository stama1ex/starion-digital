/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

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

const Catalog: React.FC<CatalogProps> = ({
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

  const getPrice = (p: ProductDTO) => {
    if (!prices) return null;
    const match = prices.find(
      (x) => x.type === p.type && x.group?.id === p.group?.id
    );
    return match?.price ?? null;
  };

  // Получаем уникальные группы (объекты, не строки)
  const uniqueGroups = products
    .map((p) => p.group)
    .filter((g): g is NonNullable<typeof g> => !!g)
    .filter(
      (group, index, self) => self.findIndex((g) => g.id === group.id) === index
    )
    .sort((a, b) => a.id - b.id); // Сортируем по ID, чтобы новые группы были в конце

  // Товары без группы
  const ungroupedProducts = products.filter((p) => !p.group);

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
            <hr className="my-12" />
            <div className="flex justify-center w-full h-full">
              <Title
                text={t(titleKey)}
                className="text-[28px] md:text-6xl font-extrabold leading-tight animate-gradient-flow text-center"
              />
            </div>
          </>
        )}

        {/* Товары по группам */}
        {uniqueGroups.map((group) => {
          const groupProducts = products.filter(
            (p) => p.group?.id === group.id
          );
          return (
            <div key={group.id}>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 px-4 md:px-0">
                {groupProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    modelUrls={modelUrls}
                    getPrice={getPrice}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Товары без группы */}
        {ungroupedProducts.length > 0 && (
          <div className="my-10">
            <h2 className="text-xl md:text-3xl font-bold mb-4 text-center md:text-start">
              Другие товары
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 px-4 md:px-0">
              {ungroupedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  modelUrls={modelUrls}
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

export default Catalog;

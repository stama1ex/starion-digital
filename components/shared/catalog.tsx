'use client';

import { Container } from '@/components/shared/container';
import { Title } from '@/components/shared/title';
import ExampleBlock from '@/components/shared/example-block';
import { useTranslations } from 'next-intl';
import { Product } from '@prisma/client';
import { ProductCard } from './product-card';

interface CatalogProps {
  titleKey: string;
  exampleProductNumber?: string;
  className?: string;
  products: Product[];
  modelUrls: Record<string, string>;
  prices?: {
    type: Product['type'];
    material: Product['material'];
    price: number;
  }[];
}

const Catalog: React.FC<CatalogProps> = ({
  titleKey,
  exampleProductNumber,
  className,
  products,
  modelUrls,
  prices,
}) => {
  const t = useTranslations('Catalog');

  const exampleProduct = exampleProductNumber
    ? products.find((p) => p.number === exampleProductNumber) || null
    : null;

  const getPrice = (p: Product) => {
    if (!prices) return null;
    const match = prices.find(
      (x) => x.type === p.type && x.material === p.material
    );
    return match?.price ?? null;
  };

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

        <hr className="my-12" />

        <div className="flex justify-center w-full h-full">
          <Title
            text={t(titleKey)}
            className="text-[28px] md:text-6xl font-extrabold leading-tight animate-gradient-flow text-center"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 my-8 px-4 md:px-0">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              modelUrls={modelUrls}
              getPrice={getPrice}
            />
          ))}
        </div>
      </Container>
    </div>
  );
};

export default Catalog;

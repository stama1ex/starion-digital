'use client';

import { Container } from '@/components/shared/container';
import { Title } from '@/components/shared/title';
import ExampleBlock from '@/components/shared/example-block';
import { useTranslations } from 'next-intl';
import { ProductCard } from './product-card';

// Типы такие же, как в Prisma
type ProductType = string;
type Material = string;

interface ProductDTO {
  id: number;
  number: string;
  type: ProductType;
  material: Material;
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
    material: Material;
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

  const getPrice = (p: ProductDTO) => {
    if (!prices) return null;
    const match = prices.find(
      (x) => x.type === p.type && x.material === p.material
    );
    return match?.price ?? null;
  };

  const materials = [...new Set(products.map((p) => p.material))] as Material[];

  const materialOrder: Material[] = ['MARBLE', 'WOOD', 'ACRYLIC'];
  const sortedMaterials = materials.sort(
    (a, b) => materialOrder.indexOf(a) - materialOrder.indexOf(b)
  );

  const materialHeader = (m: Material) => t(`material.${m.toLowerCase()}`);

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

        {sortedMaterials.map((mat) => (
          <div key={mat} className="my-10">
            <h2 className="text-xl md:text-3xl font-bold mb-4 text-center md:text-start">
              {materialHeader(mat)}
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 px-4 md:px-0">
              {products
                .filter((p) => p.material === mat)
                .map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    modelUrls={modelUrls}
                    getPrice={getPrice}
                  />
                ))}
            </div>

            <hr className="my-8 opacity-50" />
          </div>
        ))}
      </Container>
    </div>
  );
};

export default Catalog;

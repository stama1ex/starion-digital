'use client';

import { useState } from 'react';
import Catalog from '@/components/shared/catalog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MagnetProductDTO {
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

interface MagnetsCatalogContentProps {
  exampleProductNumber: string;
  products: MagnetProductDTO[];
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

export default function MagnetsCatalogContent({
  exampleProductNumber,
  products,
  modelUrls,
  prices,
}: MagnetsCatalogContentProps) {
  // Группируем товары по группам
  const groups = Array.from(
    new Set(products.map((p) => p.group?.slug).filter(Boolean))
  ) as string[];

  // Товары без группы
  const ungroupedProducts = products.filter((p) => !p.group);

  const [activeGroup, setActiveGroup] = useState<string>(groups[0] || 'all');

  // Если нет групп, показываем обычный каталог
  if (groups.length === 0) {
    return (
      <Catalog
        titleKey="magnets_title"
        exampleProductNumber={exampleProductNumber}
        products={products}
        modelUrls={modelUrls}
        prices={prices}
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Магниты</h1>

      <Tabs
        value={activeGroup}
        onValueChange={setActiveGroup}
        className="w-full"
      >
        <TabsList className="w-full justify-start mb-6 flex-wrap h-auto">
          {groups.map((group) => (
            <TabsTrigger key={group} value={group} className="px-6">
              {group}
            </TabsTrigger>
          ))}
          {ungroupedProducts.length > 0 && (
            <TabsTrigger value="all" className="px-6">
              Все остальные
            </TabsTrigger>
          )}
        </TabsList>

        {groups.map((group) => {
          const groupProducts = products.filter((p) => p.group?.slug === group);
          return (
            <TabsContent key={group} value={group}>
              <Catalog
                titleKey="magnets_title"
                exampleProductNumber={exampleProductNumber}
                products={groupProducts}
                modelUrls={modelUrls}
                prices={prices}
                hideTitle
              />
            </TabsContent>
          );
        })}

        {ungroupedProducts.length > 0 && (
          <TabsContent value="all">
            <Catalog
              titleKey="magnets_title"
              exampleProductNumber={exampleProductNumber}
              products={ungroupedProducts}
              modelUrls={modelUrls}
              prices={prices}
              hideTitle
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

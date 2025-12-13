/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import Catalog from '@/components/shared/catalog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ProductGroup {
  id: number;
  slug: string;
  translations: any;
}

interface ProductDTO {
  id: number;
  number: string;
  type: string;
  group?: ProductGroup | null;
  image: string;
  country: string;
}

interface CatalogTabsProps {
  titleKey: string;
  products: ProductDTO[];
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

export default function CatalogTabs({
  titleKey,
  products,
  modelUrls,
  prices,
}: CatalogTabsProps) {
  const locale = useLocale();

  // Переводы для "Все остальные"
  const allOthersTranslations: Record<string, string> = {
    en: 'All Others',
    ro: 'Toate Celelalte',
    ru: 'Все остальные',
  };

  // Получаем уникальные группы
  const uniqueGroups = products
    .map((p) => p.group)
    .filter((g): g is NonNullable<typeof g> => !!g)
    .filter(
      (group, index, self) => self.findIndex((g) => g.id === group.id) === index
    )
    .sort((a, b) => a.id - b.id); // Сортируем по ID, чтобы новые группы были в конце

  // Товары без группы
  const ungroupedProducts = products.filter((p) => !p.group);

  const [activeGroup, setActiveGroup] = useState<string>(
    uniqueGroups[0]?.id?.toString() || 'all'
  );

  // Функция для получения перевода группы
  const getGroupName = (group: ProductGroup) => {
    if (group.translations && typeof group.translations === 'object') {
      const translation = group.translations[locale];
      // Если есть перевод для текущей локали, используем его, иначе fallback на ru
      return translation || group.translations.ru || group.slug;
    }
    return group.slug;
  };

  return (
    <Tabs value={activeGroup} onValueChange={setActiveGroup} className="w-full">
      <TabsList className="w-fit justify-start mb-6 flex-wrap h-auto">
        {uniqueGroups.map((group) => (
          <TabsTrigger
            key={group.id}
            value={group.id.toString()}
            className="px-6"
          >
            {getGroupName(group)}
          </TabsTrigger>
        ))}
        {ungroupedProducts.length > 0 && (
          <TabsTrigger value="all" className="px-6">
            {allOthersTranslations[locale] || allOthersTranslations.ru}
          </TabsTrigger>
        )}
      </TabsList>

      {uniqueGroups.map((group) => {
        const groupProducts = products.filter((p) => p.group?.id === group.id);
        return (
          <TabsContent key={group.id} value={group.id.toString()}>
            <Catalog
              titleKey={titleKey}
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
            titleKey={titleKey}
            products={ungroupedProducts}
            modelUrls={modelUrls}
            prices={prices}
            hideTitle
          />
        </TabsContent>
      )}
    </Tabs>
  );
}

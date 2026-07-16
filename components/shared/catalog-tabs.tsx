/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Catalog from '@/components/shared/catalog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Title } from './title';

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
  hideTitle?: boolean;
}

export default function CatalogTabs({
  titleKey,
  products,
  modelUrls,
  prices,
  hideTitle = false,
}: CatalogTabsProps) {
  const locale = useLocale();
  const t = useTranslations('Catalog');

  const [searchQuery, setSearchQuery] = useState('');

  // Переводы для "Все остальные"
  const allOthersTranslations: Record<string, string> = {
    en: 'All Others',
    ro: 'Toate Celelalte',
    ru: 'Все остальные',
  };

  // Уникальные группы + товары по группам одним проходом
  const { uniqueGroups, groupedProducts, ungroupedProducts } = useMemo(() => {
    const seen = new Set<number>();
    const groups: ProductGroup[] = [];
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

    groups.sort((a, b) => a.id - b.id); // Сортируем по ID, чтобы новые группы были в конце

    return { uniqueGroups: groups, groupedProducts: byGroup, ungroupedProducts: ungrouped };
  }, [products]);

  const [activeGroup, setActiveGroup] = useState<string>(
    uniqueGroups[0]?.id?.toString() || 'all',
  );

  // Фильтрация товаров по поисковому запросу — мемоизировано, чтобы при
  // переключении вкладки без изменения query/products не пересчитывать
  // и не создавать новые ссылки на массивы для неактивных вкладок
  const filterProducts = (productsList: ProductDTO[]) => {
    if (!searchQuery.trim()) return productsList;
    return productsList.filter((p) =>
      p.number.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  };

  const filteredByGroup = useMemo(() => {
    const result = new Map<number, ProductDTO[]>();
    for (const group of uniqueGroups) {
      result.set(
        group.id,
        filterProducts(groupedProducts.get(group.id) ?? []),
      );
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueGroups, groupedProducts, searchQuery]);

  const filteredUngrouped = useMemo(
    () => filterProducts(ungroupedProducts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ungroupedProducts, searchQuery],
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
    <>
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 px-4 md:px-0">
        <Tabs
          value={activeGroup}
          onValueChange={setActiveGroup}
          className="w-full md:w-auto"
        >
          <TabsList className="w-fit justify-start flex-wrap h-auto gap-2">
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
        </Tabs>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('search_placeholder') || 'Поиск по номеру...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {uniqueGroups.map((group) => {
        const filteredProducts = filteredByGroup.get(group.id) ?? [];
        return (
          <div
            key={group.id}
            className={activeGroup === group.id.toString() ? 'block' : 'hidden'}
          >
            <Catalog
              titleKey={titleKey}
              products={filteredProducts}
              modelUrls={modelUrls}
              prices={prices}
              hideTitle
            />
          </div>
        );
      })}

      {ungroupedProducts.length > 0 && (
        <div className={activeGroup === 'all' ? 'block' : 'hidden'}>
          <Catalog
            titleKey={titleKey}
            products={filteredUngrouped}
            modelUrls={modelUrls}
            prices={prices}
            hideTitle
          />
        </div>
      )}
    </>
  );
}

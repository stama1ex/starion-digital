'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/shared/container';

export type CatalogCategoryKey = 'magnet' | 'plate' | 'card' | 'keychain';

// Порядок совпадает с навигацией в шапке сайта
const CATEGORY_ORDER: { key: CatalogCategoryKey; href: string }[] = [
  { key: 'magnet', href: '/magnets/catalog' },
  { key: 'plate', href: '/plates/catalog' },
  { key: 'card', href: '/cards/catalog' },
  { key: 'keychain', href: '/keychains/catalog' },
];

interface CategoryPaginationProps {
  current: CatalogCategoryKey;
}

export default function CategoryPagination({
  current,
}: CategoryPaginationProps) {
  const t = useTranslations('Catalog');
  const tCategories = useTranslations('Categories');

  const index = CATEGORY_ORDER.findIndex((c) => c.key === current);
  const prev = index > 0 ? CATEGORY_ORDER[index - 1] : null;
  const next =
    index >= 0 && index < CATEGORY_ORDER.length - 1
      ? CATEGORY_ORDER[index + 1]
      : null;

  if (!prev && !next) return null;

  return (
    <Container className="px-4 md:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-8 mt-4 border-t">
        {prev ? (
          <Link href={prev.href} className="sm:mr-auto">
            <Button variant="outline" className="w-full sm:w-auto gap-2">
              <ArrowLeft size={16} className="shrink-0" />
              <span className="truncate">
                {t('prev_category', { name: tCategories(`${prev.key}.name`) })}
              </span>
            </Button>
          </Link>
        ) : null}
        {next ? (
          <Link href={next.href} className="sm:ml-auto">
            <Button variant="outline" className="w-full sm:w-auto gap-2">
              <span className="truncate">
                {t('next_category', { name: tCategories(`${next.key}.name`) })}
              </span>
              <ArrowRight size={16} className="shrink-0" />
            </Button>
          </Link>
        ) : null}
      </div>
    </Container>
  );
}

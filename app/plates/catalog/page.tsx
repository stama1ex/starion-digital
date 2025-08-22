'use client';

import Catalog from '@/components/shared/catalog';
import { useTranslations } from 'next-intl';
import React from 'react';

const Page: React.FC = () => {
  const t = useTranslations('Catalog');

  return (
    <main>
      <Catalog
        title={t('plates_title')}
        dataSource="/plates.json"
        exampleProductNumber="112"
      />
    </main>
  );
};

export default Page;

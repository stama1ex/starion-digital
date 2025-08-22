'use client';

import Catalog from '@/components/shared/catalog';
import { useTranslations } from 'next-intl';
import React from 'react';

const Page: React.FC = () => {
  const t = useTranslations('Catalog');

  return (
    <main>
      <Catalog
        title={t('magnets_title')}
        dataSource="/magnets.json"
        exampleProductNumber="45"
      />
    </main>
  );
};

export default Page;

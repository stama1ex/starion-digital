// components/shared/soon.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';

export const Soon = ({ className }: { className?: string }) => {
  const t = useTranslations('Header');

  return (
    <Badge
      variant="secondary"
      className={`text-xs font-medium px-2 py-1 rounded-full shadow-2xl ${className}`}
    >
      {t('soon')}
    </Badge>
  );
};

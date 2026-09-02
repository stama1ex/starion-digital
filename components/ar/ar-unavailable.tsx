'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CameraOff } from 'lucide-react';

// Аккуратная заглушка, если опыт не найден или выключен (isActive=false).
export default function ARUnavailable() {
  const t = useTranslations('ARViewer');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-muted">
        <CameraOff className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">{t('unavailable.title')}</h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {t('unavailable.text')}
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
      >
        {t('unavailable.home')}
      </Link>
    </main>
  );
}

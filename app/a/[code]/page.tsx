import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import ARViewer from '@/components/ar/ARViewer';
import ARUnavailable from '@/components/ar/ar-unavailable';
import { arAssetUrl } from '@/lib/ar/types';
import {
  loadARExperienceByShortCode,
  toARExperienceClient,
} from '@/lib/ar/experience';

// Короткая ссылка для QR: /a/{code}.
//
// Чем короче строка в коде, тем крупнее его модули и тем увереннее он читается
// с маленькой наклейки. Плюс код ничего не говорит о сувенире, в отличие от
// slug. Сам домен в QR спрятать нельзя — это обычная ссылка; чтобы на чужих
// сувенирах не светился основной адрес, направьте на это приложение отдельный
// нейтральный домен и укажите его в NEXT_PUBLIC_AR_SHORT_URL.
export const dynamic = 'force-dynamic';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://starion-digital.com';

type PageProps = { params: Promise<{ code: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { code } = await params;
  const experience = await loadARExperienceByShortCode(code);
  const t = await getTranslations('ARViewer');

  if (!experience || !experience.isActive) {
    return {
      title: `${t('unavailable.title')} | Starion Digital`,
      robots: { index: false, follow: false },
    };
  }

  const version = String(experience.updatedAt.getTime());
  const ogImage = arAssetUrl(experience.slug, 'poster', version);
  const title = `${experience.title} — AR`;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description: t('meta.description'),
    // короткая ссылка живёт на сувенирах сторонних компаний — не индексируем
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description: t('meta.description'),
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: experience.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: t('meta.description'),
      images: [ogImage],
    },
  };
}

export default async function ARShortPage({ params }: PageProps) {
  const { code } = await params;
  const experience = await loadARExperienceByShortCode(code);

  if (!experience || !experience.isActive) {
    return <ARUnavailable />;
  }

  return <ARViewer experience={toARExperienceClient(experience)} />;
}

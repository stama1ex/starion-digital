import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import ARViewer from '@/components/ar/ARViewer';
import ARUnavailable from '@/components/ar/ar-unavailable';
import { arAssetUrl } from '@/lib/ar/types';
import {
  loadARExperienceBySlug,
  toARExperienceClient,
} from '@/lib/ar/experience';
import { isARDomainHost, SITE_URL } from '@/lib/ar/domain';

// Свежие данные на каждый запрос: временные ссылки Dropbox короткоживущие,
// а прокси ассетов и так динамический.
export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ slug: string }> };


export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const experience = await loadARExperienceBySlug(slug);
  const t = await getTranslations('ARViewer');

  if (!experience || !experience.isActive) {
    return {
      title: t('unavailable.title'),
      robots: { index: false, follow: false },
    };
  }

  const version = String(experience.updatedAt.getTime());
  const ogImage = arAssetUrl(slug, 'poster', version); // резолвится через metadataBase
  // При белой метке ни в заголовке вкладки, ни в превью для мессенджеров не
  // должно быть нашего имени, а иконка вкладки — нейтральная вместо favicon.
  const title = experience.whiteLabel
    ? experience.title
    : `${experience.title} — AR | Starion Digital`;
  const description = t('meta.description');

  // og:image берём с того же хоста, с которого открыли страницу: на отдельном
  // AR-домене абсолютная ссылка на основной сайт выдала бы его в превью
  const host = (await headers()).get('host');
  const base =
    host && isARDomainHost(host) ? `https://${host}` : SITE_URL;

  return {
    metadataBase: new URL(base),
    title,
    description,
    ...(experience.whiteLabel
      ? { icons: { icon: '/ar-icon.svg' }, robots: { index: false, follow: false } }
      : {}),
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/ar/${slug}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: experience.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ARPage({ params }: PageProps) {
  const { slug } = await params;
  const experience = await loadARExperienceBySlug(slug);

  if (!experience || !experience.isActive) {
    // На AR-домене остального сайта нет, вести «на главную» некуда
    const host = (await headers()).get('host');
    return <ARUnavailable showHome={!isARDomainHost(host)} />;
  }

  const client = toARExperienceClient(experience);

  return <ARViewer experience={client} />;
}

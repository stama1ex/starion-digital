import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import ARViewer from '@/components/ar/ARViewer';
import ARUnavailable from '@/components/ar/ar-unavailable';
import { arAssetUrl, type ARExperienceClient } from '@/lib/ar/types';

// Свежие данные на каждый запрос: временные ссылки Dropbox короткоживущие,
// а прокси ассетов и так динамический.
export const dynamic = 'force-dynamic';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://starion-digital.com';

type PageProps = { params: Promise<{ slug: string }> };

function getExperience(slug: string) {
  return prisma.aRExperience.findUnique({ where: { slug } });
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const experience = await getExperience(slug);
  const t = await getTranslations('ARViewer');

  if (!experience || !experience.isActive) {
    return {
      title: `${t('unavailable.title')} | Starion Digital`,
      robots: { index: false, follow: false },
    };
  }

  const version = String(experience.updatedAt.getTime());
  const ogImage = arAssetUrl(slug, 'poster', version); // резолвится через metadataBase
  const title = `${experience.title} — AR | Starion Digital`;
  const description = t('meta.description');

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
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
  const experience = await getExperience(slug);

  if (!experience || !experience.isActive) {
    return <ARUnavailable />;
  }

  const client: ARExperienceClient = {
    slug: experience.slug,
    title: experience.title,
    contentType: experience.contentType,
    scale: experience.scale,
    rotationX: experience.rotationX,
    rotationY: experience.rotationY,
    rotationZ: experience.rotationZ,
    offsetX: experience.offsetX,
    offsetY: experience.offsetY,
    offsetZ: experience.offsetZ,
    autoplay: experience.autoplay,
    loop: experience.loop,
    sound: experience.sound,
    hasPoster: !!experience.posterUrl,
    version: String(experience.updatedAt.getTime()),
  };

  return <ARViewer experience={client} />;
}

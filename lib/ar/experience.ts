import { cache } from 'react';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { cleanAudioTracks } from './constants';
import { cleanSocials } from './socials';
import { isR2Path, r2Key } from './server';
import { r2PublicUrl } from '@/lib/r2';
import { arAssetUrl } from './types';
import type { ARAssetUrls, ARExperienceClient } from './types';

// Загрузка/маппинг опыта для публичной страницы /ar/{slug}. Обёрнуто в React
// cache(), поэтому generateMetadata и сам рендер страницы делят один запрос.
export const loadARExperience = cache(
  async (where: Prisma.ARExperienceWhereUniqueInput) => {
    try {
      return await prisma.aRExperience.findUnique({ where });
    } catch (error) {
      // Сбой БД не должен превращаться в 500 у человека, сканирующего QR, —
      // он увидит аккуратную заглушку.
      console.error('[AR] experience lookup failed', where, error);
      return null;
    }
  }
);

export const loadARExperienceBySlug = (slug: string) =>
  loadARExperience({ slug });

type LoadedExperience = NonNullable<
  Awaited<ReturnType<typeof loadARExperience>>
>;

// Приводит запись БД к тому, что уходит в браузер. Пути Dropbox не отдаём —
// ассеты забираются через прокси /api/ar/{slug}/asset.
// Адрес одного ассета: для R2 — прямая публичная ссылка, для Dropbox — наш
// прокси (он резолвит временную ссылку и стримит файл).
function assetUrl(
  experience: LoadedExperience,
  path: string | null,
  kind: Parameters<typeof arAssetUrl>[1],
  index?: number
): string {
  if (!path) return '';
  if (isR2Path(path)) {
    const direct = r2PublicUrl(r2Key(path));
    if (direct) return direct;
  }
  return arAssetUrl(
    experience.slug,
    kind,
    String(experience.updatedAt.getTime()),
    index
  );
}

function buildAssetUrls(experience: LoadedExperience): ARAssetUrls {
  const tracks = cleanAudioTracks(experience.audioTracks) ?? [];
  return {
    marker: assetUrl(experience, experience.markerUrl, 'marker'),
    mind: assetUrl(experience, experience.mindFileUrl, 'mind'),
    content: assetUrl(experience, experience.contentUrl, 'content'),
    // постер не задан — прокси сам подставит маркер, поэтому спрашиваем его
    poster: experience.posterUrl
      ? assetUrl(experience, experience.posterUrl, 'poster')
      : assetUrl(experience, experience.markerUrl, 'poster'),
    mask: assetUrl(experience, experience.maskUrl, 'mask'),
    texture: assetUrl(experience, experience.textureUrl, 'texture'),
    audio: tracks.map((t, i) => assetUrl(experience, t.path, 'audio', i)),
  };
}

export function toARExperienceClient(
  experience: LoadedExperience
): ARExperienceClient {
  return {
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
    hasMask: !!experience.maskUrl,
    hasTexture: !!experience.textureUrl,
    socials: cleanSocials(experience.socials),
    audioTracks: (cleanAudioTracks(experience.audioTracks) ?? []).map(
      ({ lang, label }) => ({ lang, label })
    ),
    whiteLabel: experience.whiteLabel,
    animationClip: experience.animationClip,
    version: String(experience.updatedAt.getTime()),
    assets: buildAssetUrls(experience),
  };
}

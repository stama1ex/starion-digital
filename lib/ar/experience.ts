import { cache } from 'react';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { cleanAudioTracks } from './constants';
import { cleanSocials } from './socials';
import type { ARExperienceClient } from './types';

// Общая загрузка/маппинг опыта для обеих публичных страниц: /ar/{slug} и
// короткой /a/{code}. Обёрнуто в React cache(), поэтому generateMetadata и сам
// рендер страницы делят один запрос.
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

export const loadARExperienceByShortCode = (shortCode: string) =>
  loadARExperience({ shortCode });

type LoadedExperience = NonNullable<
  Awaited<ReturnType<typeof loadARExperience>>
>;

// Приводит запись БД к тому, что уходит в браузер. Пути Dropbox не отдаём —
// ассеты забираются через прокси /api/ar/{slug}/asset.
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
    version: String(experience.updatedAt.getTime()),
  };
}

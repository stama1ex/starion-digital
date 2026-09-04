'use client';

import {
  FaGlobe,
  FaInstagram,
  FaFacebookF,
  FaTiktok,
  FaYoutube,
  FaTelegram,
  FaWhatsapp,
  FaPhone,
  FaEnvelope,
} from 'react-icons/fa6';
import type { IconType } from 'react-icons';
import {
  AR_SOCIAL_KEYS,
  AR_SOCIAL_META,
  socialHref,
  type ARSocialKey,
  type ARSocials,
} from '@/lib/ar/socials';

const ICONS: Record<ARSocialKey, IconType> = {
  website: FaGlobe,
  instagram: FaInstagram,
  facebook: FaFacebookF,
  tiktok: FaTiktok,
  youtube: FaYoutube,
  telegram: FaTelegram,
  whatsapp: FaWhatsapp,
  phone: FaPhone,
  email: FaEnvelope,
};

// Кнопки соцсетей поверх AR-сцены. Рисуются только те сети, которые заполнены
// при создании оживления, — пустых заглушек нет.
export function ARSocialLinks({
  socials,
  className,
}: {
  socials: ARSocials | null;
  className?: string;
}) {
  if (!socials) return null;

  const links = AR_SOCIAL_KEYS.map((key) => {
    const raw = socials[key];
    if (!raw) return null;
    const href = socialHref(key, raw);
    return href ? { key, href } : null;
  }).filter(Boolean) as Array<{ key: ARSocialKey; href: string }>;

  if (!links.length) return null;

  return (
    <div className={className}>
      {links.map(({ key, href }) => {
        const Icon = ICONS[key];
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={AR_SOCIAL_META[key].label}
            className="grid h-11 w-11 place-items-center rounded-full bg-white/20 text-white transition active:scale-95 hover:bg-white/35"
          >
            <Icon className="h-5 w-5" />
          </a>
        );
      })}
    </div>
  );
}

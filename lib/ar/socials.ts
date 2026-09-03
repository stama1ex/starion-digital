// Ссылки на соцсети, которые показываются кнопками поверх AR-сцены.
// Хранятся одним JSON-полем ARExperience.socials — набор сетей меняется чаще,
// чем стоит гонять миграции, а в проекте Json уже используется так же
// (ProductGroup.translations, Order.customPrices).

export const AR_SOCIAL_KEYS = [
  'website',
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'telegram',
  'whatsapp',
  'phone',
  'email',
] as const;

export type ARSocialKey = (typeof AR_SOCIAL_KEYS)[number];

export type ARSocials = Partial<Record<ARSocialKey, string>>;

export const AR_SOCIAL_META: Record<
  ARSocialKey,
  { label: string; placeholder: string; hint?: string }
> = {
  website: { label: 'Сайт', placeholder: 'https://example.com' },
  instagram: { label: 'Instagram', placeholder: 'https://instagram.com/... или @username' },
  facebook: { label: 'Facebook', placeholder: 'https://facebook.com/...' },
  tiktok: { label: 'TikTok', placeholder: 'https://tiktok.com/@... или @username' },
  youtube: { label: 'YouTube', placeholder: 'https://youtube.com/@...' },
  telegram: { label: 'Telegram', placeholder: 'https://t.me/... или @username' },
  whatsapp: { label: 'WhatsApp', placeholder: '+37360000000' },
  phone: { label: 'Телефон', placeholder: '+37360000000' },
  email: { label: 'Email', placeholder: 'hello@example.com' },
};

// Приводит то, что ввёл админ, к рабочему href. Юзернеймы без схемы —
// частый случай, поэтому достраиваем адрес сами, а не заставляем вспоминать
// полный URL.
export function socialHref(key: ARSocialKey, raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const handle = value.replace(/^@/, '');
  const isUrl = /^https?:\/\//i.test(value);

  switch (key) {
    case 'phone':
      return `tel:${value.replace(/[^\d+]/g, '')}`;
    case 'email':
      return value.includes('@') ? `mailto:${value}` : null;
    case 'whatsapp': {
      if (isUrl) return value;
      const digits = value.replace(/\D/g, '');
      return digits ? `https://wa.me/${digits}` : null;
    }
    case 'website':
      return isUrl ? value : `https://${value}`;
    case 'instagram':
      return isUrl ? value : `https://instagram.com/${handle}`;
    case 'facebook':
      return isUrl ? value : `https://facebook.com/${handle}`;
    case 'tiktok':
      return isUrl ? value : `https://tiktok.com/@${handle}`;
    case 'youtube':
      return isUrl ? value : `https://youtube.com/@${handle}`;
    case 'telegram':
      return isUrl ? value : `https://t.me/${handle}`;
    default:
      return null;
  }
}

// Оставляет только непустые значения — в БД и на клиент уходит ровно то,
// что заполнено, а вьюер рисует кнопки по наличию ключа.
export function cleanSocials(input: unknown): ARSocials | null {
  if (!input || typeof input !== 'object') return null;
  const source = input as Record<string, unknown>;
  const out: ARSocials = {};
  for (const key of AR_SOCIAL_KEYS) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      out[key] = value.trim().slice(0, 300);
    }
  }
  return Object.keys(out).length ? out : null;
}

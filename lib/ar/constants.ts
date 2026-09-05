// Общие константы WebAR-модуля «Оживление сувениров». Файл без серверных
// импортов — используется и на клиенте (ARViewer, админка), и на сервере.
import type { ARContentType } from '@prisma/client';

export const AR_CONTENT_TYPES: ARContentType[] = [
  'VIDEO',
  'MODEL3D',
  'ANIMATION',
];

// Подписи для админки (интерфейс админки в проекте — на русском).
export const AR_CONTENT_TYPE_LABELS: Record<ARContentType, string> = {
  VIDEO: 'Видео на маркере',
  MODEL3D: '3D-модель (GLB)',
  ANIMATION: 'Анимация (GLB)',
};

export const AR_CONTENT_TYPE_HINTS: Record<ARContentType, string> = {
  VIDEO: 'Видео-текстура на поверхности сувенира — для магнитов',
  MODEL3D: 'Статичная 3D-модель-«голограмма» поверх сувенира — для открыток',
  ANIMATION: 'GLB со встроенной анимацией, проигрывается при наведении',
};

// Типы ассетов, которые отдаёт публичный прокси /api/ar/[slug]/asset
export const AR_ASSET_KINDS = [
  'marker',
  'mind',
  'content',
  'poster',
  'mask',
  'texture',
  'audio',
] as const;
export type ARAssetKind = (typeof AR_ASSET_KINDS)[number];

// Папка в Dropbox, куда складываются AR-ассеты
export const AR_DROPBOX_DIR = '/ar';

// Ограничения на загрузку (проверяются на клиенте перед выдачей upload-link
// и ещё раз при выдаче ссылки на сервере)
export const AR_UPLOAD_LIMITS: Record<
  ARAssetKind,
  { maxBytes: number; accept: string; label: string }
> = {
  marker: {
    maxBytes: 8 * 1024 * 1024,
    accept: 'image/png,image/jpeg,image/webp',
    label: 'изображение-маркер',
  },
  poster: {
    maxBytes: 8 * 1024 * 1024,
    accept: 'image/png,image/jpeg,image/webp',
    label: 'постер',
  },
  mind: {
    maxBytes: 10 * 1024 * 1024,
    accept: '.mind,application/octet-stream',
    label: '.mind файл',
  },
  content: {
    maxBytes: 100 * 1024 * 1024,
    accept: 'video/mp4,video/webm,video/quicktime,model/gltf-binary,.glb',
    label: 'контент (видео / GLB)',
  },
  mask: {
    maxBytes: 8 * 1024 * 1024,
    accept: 'image/png,image/webp',
    label: 'маска-силуэт',
  },
  texture: {
    maxBytes: 32 * 1024 * 1024,
    accept: 'image/jpeg,image/png,image/webp',
    label: 'текстура модели',
  },
  audio: {
    maxBytes: 32 * 1024 * 1024,
    accept: 'audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,.mp3,.m4a',
    label: 'аудиодорожка',
  },
};

// Языки озвучки. Совпадают с локалями сайта только частично: озвучек может не
// быть на все языки интерфейса, и наоборот — сувенир под конкретный рынок
// требует языка, которого на сайте нет. Порядок здесь — только порядок в
// выпадающем списке; какой язык будет по умолчанию во вьюере, решает порядок
// дорожек в конкретном оживлении.
//
// Нужен ещё язык — допишите строку, больше ничего менять не надо: подпись из
// label показывается и в админке, и в переключателе вьюера.
export const AR_AUDIO_LANGS = [
  { code: 'en', label: 'English' },
  { code: 'ro', label: 'Română' },
  { code: 'ru', label: 'Русский' },
  { code: 'uk', label: 'Українська' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
  { code: 'pl', label: 'Polski' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'cs', label: 'Čeština' },
  { code: 'sk', label: 'Slovenčina' },
  { code: 'hu', label: 'Magyar' },
  { code: 'bg', label: 'Български' },
  { code: 'sr', label: 'Srpski' },
  { code: 'el', label: 'Ελληνικά' },
  { code: 'he', label: 'עברית' },
  { code: 'ar', label: 'العربية' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
] as const;

export interface ARAudioTrack {
  lang: string; // код языка, напр. 'ru'
  label: string; // как показать в переключателе
  path: string; // путь в Dropbox
}

// Нормализует дорожки из тела запроса: выкидывает пустые, режет длины,
// схлопывает дубли по языку (в переключателе два «Русский» бессмысленны).
export function cleanAudioTracks(input: unknown): ARAudioTrack[] | null {
  if (!Array.isArray(input)) return null;
  const seen = new Set<string>();
  const out: ARAudioTrack[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const path = typeof item.path === 'string' ? item.path.trim() : '';
    const lang = typeof item.lang === 'string' ? item.lang.trim().slice(0, 8) : '';
    if (!path || !lang || seen.has(lang)) continue;
    seen.add(lang);
    const known = AR_AUDIO_LANGS.find((l) => l.code === lang);
    const label =
      typeof item.label === 'string' && item.label.trim()
        ? item.label.trim().slice(0, 40)
        : (known?.label ?? lang.toUpperCase());
    out.push({ lang, label, path });
  }
  return out.length ? out : null;
}

// Значения по умолчанию для формы создания опыта
export const AR_EXPERIENCE_DEFAULTS = {
  scale: 1,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  autoplay: true,
  loop: true,
  sound: true,
  isActive: true,
  // По умолчанию оживление обезличено: так QR ведёт на короткий ar3d.io, а
  // во вьюере нет наших ссылок. Для своих сувениров галочку снимают вручную.
  whiteLabel: true,
};

// Приводит произвольную строку к безопасному slug для URL/QR (/ar/{slug})
export function slugifyAr(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export const AR_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

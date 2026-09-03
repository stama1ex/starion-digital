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
};

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
  sound: false,
  isActive: true,
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

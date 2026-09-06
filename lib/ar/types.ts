import type { ARContentType } from '@prisma/client';
import type { ARAssetKind, ARAudioTrack } from './constants';
import type { ARSocials } from './socials';

// Данные AR-опыта в том виде, в каком серверная страница отдаёт их клиентскому
// ARViewer. Пути Dropbox на клиент не уходят — ассеты берутся через прокси
// /api/ar/{slug}/asset.
export interface ARExperienceClient {
  slug: string;
  title: string;
  contentType: ARContentType;
  scale: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  autoplay: boolean;
  loop: boolean;
  sound: boolean;
  hasPoster: boolean;
  // альфа-маска-силуэт для фигурных магнитов (тип VIDEO): видео видно только
  // там, где маска светлая
  hasMask: boolean;
  // отдельная текстура-атлас для GLB без встроенных текстур (MODEL3D/ANIMATION)
  hasTexture: boolean;
  // заполненные ссылки на соцсети — кнопками поверх AR
  socials: ARSocials | null;
  // озвучки по языкам; если непусто — звук видео глушится, играет дорожка
  audioTracks: Array<Pick<ARAudioTrack, 'lang' | 'label'>>;
  // белая метка: вьюер не показывает ни подпись, ни ссылку на наш каталог —
  // для сувениров, которые делаются под чужим брендом
  whiteLabel: boolean;
  // выбранный анимационный клип; пусто — первый подходящий из файла
  animationClip: string | null;
  // метка версии (updatedAt) для инвалидации CDN-кэша прокси при замене ассета
  version: string;
  // Готовые адреса файлов. Для нового хранилища (R2) это прямые публичные
  // ссылки — браузер качает их мимо нашего сервера, и раздача нам ничего не
  // стоит. Для файлов, оставшихся в Dropbox, здесь адрес нашего прокси, как
  // и раньше. Пустая строка означает, что ассет не задан.
  assets: ARAssetUrls;
}

export interface ARAssetUrls {
  marker: string;
  mind: string;
  content: string;
  poster: string;
  mask: string;
  texture: string;
  audio: string[];
}

export function arAssetUrl(
  slug: string,
  kind: ARAssetKind,
  version?: string,
  index?: number
): string {
  const v = version ? `&v=${encodeURIComponent(version)}` : '';
  const i = typeof index === 'number' ? `&i=${index}` : '';
  return `/api/ar/${encodeURIComponent(slug)}/asset?kind=${kind}${v}${i}`;
}

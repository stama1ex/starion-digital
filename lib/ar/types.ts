import type { ARContentType } from '@prisma/client';
import type { ARAssetKind } from './constants';

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
  // метка версии (updatedAt) для инвалидации CDN-кэша прокси при замене ассета
  version: string;
}

export function arAssetUrl(
  slug: string,
  kind: ARAssetKind,
  version?: string
): string {
  const v = version ? `&v=${encodeURIComponent(version)}` : '';
  return `/api/ar/${encodeURIComponent(slug)}/asset?kind=${kind}${v}`;
}

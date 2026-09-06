// Уборка файлов оживления. Сам механизм общий для всего сайта и лежит в
// lib/storage/cleanup — здесь только то, что специфично для AR: из каких
// полей записи собираются пути к файлам.
import {
  releaseStorageObjects,
  type CleanupResult,
} from '@/lib/storage/cleanup';

// Поля записи, в которых лежат пути к файлам
const ASSET_FIELDS = [
  'markerUrl',
  'mindFileUrl',
  'contentUrl',
  'posterUrl',
  'maskUrl',
  'textureUrl',
] as const;

type AssetRecord = Record<string, unknown>;

// Все пути к файлам одной записи, включая аудиодорожки
export function experienceAssetPaths(exp: AssetRecord): string[] {
  const out: string[] = [];

  for (const field of ASSET_FIELDS) {
    const value = exp[field];
    if (typeof value === 'string' && value) out.push(value);
  }

  const tracks = exp.audioTracks;
  if (Array.isArray(tracks)) {
    for (const track of tracks) {
      const path = (track as AssetRecord | null)?.path;
      if (typeof path === 'string' && path) out.push(path);
    }
  }

  return out;
}

// Файлы, которые были у записи до правки и пропали после неё
export function staleAssetPaths(
  before: AssetRecord,
  after: AssetRecord
): string[] {
  const kept = new Set(experienceAssetPaths(after));
  return experienceAssetPaths(before).filter((path) => !kept.has(path));
}

export async function releaseARAssets(
  paths: Array<string | null | undefined>,
  options: { sweepFolder?: boolean } = {}
): Promise<CleanupResult> {
  return releaseStorageObjects(paths, options);
}

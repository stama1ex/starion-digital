// Уборка файлов в R2 после изменений в админке: заменили маркер — старый
// удаляем, удалили оживление — выметаем его папку целиком.
//
// Главная опасность здесь — снести файл, который использует другое оживление
// (один и тот же маркер вполне может быть у нескольких сувениров). Поэтому
// перед каждым удалением спрашиваем базу, кто на что ссылается, и трогаем
// только то, на что уже не ссылается никто. Вызывать нужно ПОСЛЕ записи в
// базу: тогда «кто ссылается» считается по новому состоянию.
//
// Файлы в Dropbox не трогаем намеренно: там же лежат картинки товаров, а
// старые оживления после переезда на R2 туда уже не ссылаются.
import { prisma } from '@/lib/db';
import { deleteObject, isR2Configured, listObjectKeys } from '@/lib/r2';
import { AR_DROPBOX_DIR } from './constants';
import { isR2Path, r2Key } from './server';

// Поля записи, в которых лежат пути к файлам
const ASSET_FIELDS = [
  'markerUrl',
  'mindFileUrl',
  'contentUrl',
  'posterUrl',
  'maskUrl',
  'textureUrl',
] as const;

// Корень AR-файлов в ключах R2: '/ar' -> 'ar/'
const AR_ROOT = `${AR_DROPBOX_DIR.replace(/^\/+/, '')}/`;

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

// Ключи R2, на которые сейчас ссылается хоть одно оживление. Читаем все записи
// целиком: их десятки, а не миллионы, и это надёжнее, чем собирать условия по
// JSON-полю с аудиодорожками.
async function keysInUse(): Promise<Set<string>> {
  const rows = await prisma.aRExperience.findMany({
    select: {
      markerUrl: true,
      mindFileUrl: true,
      contentUrl: true,
      posterUrl: true,
      maskUrl: true,
      textureUrl: true,
      audioTracks: true,
    },
  });

  const used = new Set<string>();
  for (const row of rows) {
    for (const path of experienceAssetPaths(row)) {
      if (isR2Path(path)) used.add(r2Key(path));
    }
  }
  return used;
}

// Папки, в которых лежат переданные файлы. Только вложенные папки оживлений
// (ar/<Название>/), никогда не сам корень ar/ — иначе одна кривая запись
// вынесла бы всё хранилище.
function folderPrefixes(keys: string[]): string[] {
  const out = new Set<string>();
  for (const key of keys) {
    const cut = key.lastIndexOf('/');
    if (cut < 0) continue;
    const prefix = key.slice(0, cut + 1);
    if (prefix.startsWith(AR_ROOT) && prefix.length > AR_ROOT.length) {
      out.add(prefix);
    }
  }
  return [...out];
}

export interface ARCleanupResult {
  deleted: number;
  failed: number;
}

/**
 * Удаляет из R2 переданные файлы, если на них больше никто не ссылается.
 *
 * @param paths   пути в том виде, в каком они лежат в базе ('r2:ar/...')
 * @param options sweepFolder — вымести папки этих файлов целиком (при удалении
 *                оживления), чтобы не оставались брошенные загрузки
 */
export async function releaseARAssets(
  paths: Array<string | null | undefined>,
  options: { sweepFolder?: boolean } = {}
): Promise<ARCleanupResult> {
  const result: ARCleanupResult = { deleted: 0, failed: 0 };
  if (!isR2Configured()) return result;

  const keys = [
    ...new Set(
      paths
        .filter((p): p is string => isR2Path(p))
        .map(r2Key)
        .filter((k) => k.startsWith(AR_ROOT))
    ),
  ];
  if (!keys.length) return result;

  try {
    const used = await keysInUse();
    const doomed = new Set(keys.filter((key) => !used.has(key)));

    if (options.sweepFolder) {
      const usedList = [...used];
      for (const prefix of folderPrefixes(keys)) {
        // в папке остались файлы другого оживления — подметать нельзя
        if (usedList.some((key) => key.startsWith(prefix))) continue;
        for (const key of await listObjectKeys(prefix)) doomed.add(key);
      }
    }

    // Ошибка удаления не должна ломать ответ админки: запись в базе уже
    // изменена, а лишний файл в хранилище — не поломка, просто мусор.
    const outcomes = await Promise.allSettled(
      [...doomed].map((key) => deleteObject(key))
    );
    for (const outcome of outcomes) {
      if (outcome.status === 'fulfilled') result.deleted++;
      else {
        result.failed++;
        console.error('[AR] не удалось удалить файл в R2:', outcome.reason);
      }
    }
  } catch (error) {
    console.error('[AR] уборка в R2 не удалась:', error);
  }

  return result;
}

// Файлы, которые были у записи до правки и пропали после неё
export function staleAssetPaths(
  before: AssetRecord,
  after: AssetRecord
): string[] {
  const kept = new Set(experienceAssetPaths(after));
  return experienceAssetPaths(before).filter((path) => !kept.has(path));
}

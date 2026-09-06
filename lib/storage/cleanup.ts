// Уборка файлов в R2 после изменений в админке: заменили картинку — старую
// удаляем, удалили запись — удаляем её файлы.
//
// Главная опасность здесь — снести файл, который использует другая запись
// (один и тот же маркер вполне может быть у нескольких сувениров). Поэтому
// перед каждым удалением спрашиваем базу, кто на что ссылается, и трогаем
// только то, на что уже не ссылается никто. Считаем сразу по всем таблицам,
// где хранятся пути к файлам: их немного, а перепутать источник — дороже.
//
// Вызывать нужно ПОСЛЕ записи в базу: тогда «кто ссылается» считается по
// новому состоянию.
//
// Файлы в Dropbox не трогаем намеренно: пока переезд не закончен, там ещё
// лежит то, на что часть записей ссылается, и удалять их отсюда рано.
import { prisma } from '@/lib/db';
import {
  deleteObject,
  isR2Configured,
  isR2Path,
  listObjectKeys,
  r2Key,
} from '@/lib/r2';

// Папки верхнего уровня, в которых нам вообще позволено удалять. Всё
// остальное игнорируем — защита от кривого пути, который случайно уедет
// в аргументы.
export const STORAGE_ROOTS = ['ar/', 'products/'];

const underAllowedRoot = (key: string) =>
  STORAGE_ROOTS.some((root) => key.startsWith(root));

export interface CleanupResult {
  deleted: number;
  failed: number;
}

// Ключи R2, на которые сейчас ссылается хоть одна запись в базе. Читаем
// таблицы целиком: строк сотни, а не миллионы, и это надёжнее, чем собирать
// условия по JSON-полю с аудиодорожками.
async function keysInUse(): Promise<Set<string>> {
  const [experiences, products] = await Promise.all([
    prisma.aRExperience.findMany({
      select: {
        markerUrl: true,
        mindFileUrl: true,
        contentUrl: true,
        posterUrl: true,
        maskUrl: true,
        textureUrl: true,
        audioTracks: true,
      },
    }),
    prisma.product.findMany({ select: { image: true } }),
  ]);

  const used = new Set<string>();
  const add = (path: unknown) => {
    if (typeof path === 'string' && isR2Path(path)) used.add(r2Key(path));
  };

  for (const exp of experiences) {
    add(exp.markerUrl);
    add(exp.mindFileUrl);
    add(exp.contentUrl);
    add(exp.posterUrl);
    add(exp.maskUrl);
    add(exp.textureUrl);
    if (Array.isArray(exp.audioTracks)) {
      for (const track of exp.audioTracks) {
        add((track as Record<string, unknown> | null)?.path);
      }
    }
  }
  for (const product of products) add(product.image);

  return used;
}

// Папки, в которых лежат переданные файлы. Только вложенные (ar/<Название>/),
// никогда не сама разрешённая папка верхнего уровня — иначе одна кривая
// запись вынесла бы все картинки товаров разом.
function folderPrefixes(keys: string[]): string[] {
  const out = new Set<string>();
  for (const key of keys) {
    const cut = key.lastIndexOf('/');
    if (cut < 0) continue;
    const prefix = key.slice(0, cut + 1);
    const root = STORAGE_ROOTS.find((r) => prefix.startsWith(r));
    if (root && prefix.length > root.length) out.add(prefix);
  }
  return [...out];
}

/**
 * Удаляет из R2 переданные файлы, если на них больше никто не ссылается.
 *
 * @param paths   пути в том виде, в каком они лежат в базе ('r2:ar/...')
 * @param options sweepFolder — вымести папки этих файлов целиком (при удалении
 *                оживления), чтобы не оставались брошенные загрузки
 */
export async function releaseStorageObjects(
  paths: Array<string | null | undefined>,
  options: { sweepFolder?: boolean } = {}
): Promise<CleanupResult> {
  const result: CleanupResult = { deleted: 0, failed: 0 };
  if (!isR2Configured()) return result;

  const keys = [
    ...new Set(
      paths
        .filter((p): p is string => isR2Path(p))
        .map(r2Key)
        .filter(underAllowedRoot)
    ),
  ];
  if (!keys.length) return result;

  try {
    const used = await keysInUse();
    const doomed = new Set(keys.filter((key) => !used.has(key)));

    if (options.sweepFolder) {
      const usedList = [...used];
      for (const prefix of folderPrefixes(keys)) {
        // в папке остались файлы другой записи — подметать нельзя
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
        console.error('[storage] не удалось удалить файл в R2:', outcome.reason);
      }
    }
  } catch (error) {
    console.error('[storage] уборка в R2 не удалась:', error);
  }

  return result;
}

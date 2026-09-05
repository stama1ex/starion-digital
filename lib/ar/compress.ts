import { AR_UPLOAD_LIMITS, type ARAssetKind } from './constants';

// Сжатие изображений перед отправкой в Dropbox.
//
// Зачем: маркер, постер и текстура приезжают прямо с фотоаппарата или из
// экспорта — по 5–8 МБ на файл. Каждый из них потом качается на телефон по
// мобильной сети перед стартом AR, и это самая заметная часть ожидания.
// Разрешение при этом избыточно: MindAR всё равно уменьшает маркер до своих
// рабочих размеров, а текстура крупнее 2048 на модели размером с открытку не
// даёт ничего видимого.
//
// Сжимаем в WebP: он держит альфу (без неё сломались бы фигурные магниты и
// маска-силуэт) и при том же качестве весит в разы меньше JPEG.

const MAX_EDGE: Partial<Record<ARAssetKind, number>> = {
  marker: 1600,
  poster: 1600,
  mask: 1600,
  texture: 2048,
};

// Маркер жмём почти без потерь: из него компилируются признаки распознавания,
// и артефакты сжатия напрямую бьют по качеству трекинга. Остальным картинкам
// такая точность не нужна.
const QUALITY: Partial<Record<ARAssetKind, number>> = {
  marker: 0.98,
  mask: 0.98,
  poster: 0.88,
  texture: 0.9,
};

export function isCompressibleImage(kind: ARAssetKind, file: File): boolean {
  if (!MAX_EDGE[kind]) return false;
  // SVG и прочую векторику через canvas гнать нельзя — потеряем масштабируемость
  return /^image\/(jpeg|png|webp)$/.test(file.type);
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Safari до 17 не умеет createImageBitmap для некоторых PNG — падаем на <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('не удалось прочитать изображение'));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

export interface CompressResult {
  file: File;
  before: number;
  after: number;
  width: number;
  height: number;
  changed: boolean;
}

// Возвращает сжатый файл либо исходный, если сжатие ничего не дало или
// браузер не справился: загрузка не должна ломаться из-за оптимизации.
export async function compressImage(
  kind: ARAssetKind,
  file: File
): Promise<CompressResult> {
  const asIs: CompressResult = {
    file,
    before: file.size,
    after: file.size,
    width: 0,
    height: 0,
    changed: false,
  };
  const maxEdge = MAX_EDGE[kind];
  if (!maxEdge || !isCompressibleImage(kind, file)) return asIs;

  try {
    const src = await decode(file);
    const sw = 'width' in src ? src.width : 0;
    const sh = 'height' in src ? src.height : 0;
    if (!sw || !sh) return asIs;

    const scale = Math.min(1, maxEdge / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return asIs;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);
    if ('close' in src) src.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', QUALITY[kind] ?? 0.9)
    );
    if (!blob) return asIs;

    // Мелкий файл после пережатия может оказаться крупнее исходного —
    // тогда оставляем оригинал.
    if (blob.size >= file.size) {
      return { ...asIs, width: sw, height: sh };
    }

    const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
    return {
      file: new File([blob], name, { type: 'image/webp' }),
      before: file.size,
      after: blob.size,
      width: w,
      height: h,
      changed: true,
    };
  } catch (error) {
    console.warn('[AR] сжать изображение не удалось, грузим как есть', error);
    return asIs;
  }
}

// Человеческий размер файла для тостов в админке
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  return Math.max(1, Math.round(bytes / 1024)) + ' КБ';
}

export function limitLabel(kind: ARAssetKind): string {
  return formatBytes(AR_UPLOAD_LIMITS[kind].maxBytes);
}

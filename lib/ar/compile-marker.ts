// Компиляция изображения-маркера в .mind прямо в браузере админки — тот же
// код, что крутится на официальной странице веб-компилятора MindAR, только без
// похода на сторонний сайт и ручного скачивания/загрузки файла.
//
// Почему не CLI-скрипт: офлайн-компилятор MindAR тянет нативный `canvas`
// (node-gyp), который не собирается ни локально на Windows, ни в сборке на
// Vercel — ровно та же причина, по которой mind-ar не стоит npm-зависимостью.
// Браузерная сборка этой проблемы лишена и работает у любого админа.

import { loadMindArCompilerClass } from './config';
import { silhouetteBlurSigma, keepWeight } from './marker-inset';

// Ограничение длинной стороны маркера перед компиляцией. Больше 1024 px даёт
// заметно более тяжёлый .mind и долгую компиляцию, а на качество трекинга почти
// не влияет — MindAR всё равно строит собственную пирамиду масштабов.
export const AR_MARKER_MAX_SIZE = 1024;

// Насколько втянуть область трекинга внутрь сувенира, доля короткой стороны.
// Сувенир держат в руках, и пальцы закрывают именно края — а признаки у края
// самые сильные: контур высечки это перепад от фона к рисунку, самый
// контрастный контур во всём изображении. Трекер опирается на них охотнее
// всего, поэтому палец на кромке убивает непропорционально много точек.
//
// 6 % оставляет около 80 % площади. Больше брать не стоит: MindAR ведёт
// трекинг по шаблону с короткой стороной 256 px, и чем меньше рабочая область,
// тем ближе придётся подносить сувенир.
export const AR_MARKER_TRACK_INSET = 0.06;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('не удалось прочитать изображение'));
    img.src = src;
  });
}

// Ужимаем до AR_MARKER_MAX_SIZE, сохраняя пропорции (они попадают в .mind и
// задают форму плоскости контента, поэтому искажать нельзя).
async function normalizeMarkerImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const original = await loadImage(objectUrl);
    const longest = Math.max(original.naturalWidth, original.naturalHeight);
    if (longest <= AR_MARKER_MAX_SIZE) return original;

    const ratio = AR_MARKER_MAX_SIZE / longest;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(original.naturalWidth * ratio);
    canvas.height = Math.round(original.naturalHeight * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(original, 0, 0, canvas.width, canvas.height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    );
    if (!blob) return original;

    const resizedUrl = URL.createObjectURL(blob);
    try {
      return await loadImage(resizedUrl);
    } finally {
      URL.revokeObjectURL(resizedUrl);
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Сводит внешнюю полосу к ровной заливке, НЕ меняя размер изображения:
// markerDimensions, пропорции и плоскость контента должны остаться прежними,
// иначе поехал бы весь уже настроенный контент и понадобилась бы миграция.
//
// Втягиваем сам силуэт, а не прямоугольник: сувениры высечены по контуру, и
// прямоугольный отступ у фигурной формы срезал бы середину с одной стороны и
// не тронул край с другой. Размытая маска прозрачности даёт одновременно и
// втягивание, и мягкий переход, а для прямоугольного маркера честно
// вырождается в обычный отступ от краёв.
async function insetForTracking(
  image: HTMLImageElement,
  inset: number
): Promise<HTMLImageElement> {
  if (!(inset > 0)) return image;
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return image;

  const makeCanvas = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  };

  // силуэт: белое там, где маркер непрозрачен
  const silhouette = makeCanvas();
  const silhouetteCtx = silhouette.getContext('2d');
  if (!silhouetteCtx) return image;
  silhouetteCtx.drawImage(image, 0, 0, width, height);
  silhouetteCtx.globalCompositeOperation = 'source-in';
  silhouetteCtx.fillStyle = '#fff';
  silhouetteCtx.fillRect(0, 0, width, height);

  // размытый силуэт на чёрном — это карта глубины от края
  const depth = makeCanvas();
  const depthCtx = depth.getContext('2d', { willReadFrequently: true });
  if (!depthCtx) return image;
  depthCtx.fillStyle = '#000';
  depthCtx.fillRect(0, 0, width, height);
  depthCtx.filter = `blur(${silhouetteBlurSigma(Math.min(width, height), inset)}px)`;
  depthCtx.drawImage(silhouette, 0, 0);
  depthCtx.filter = 'none';

  const out = makeCanvas();
  const outCtx = out.getContext('2d', { willReadFrequently: true });
  if (!outCtx) return image;
  outCtx.drawImage(image, 0, 0, width, height);

  let pixels: ImageData;
  let depthMap: ImageData;
  try {
    pixels = outCtx.getImageData(0, 0, width, height);
    depthMap = depthCtx.getImageData(0, 0, width, height);
  } catch {
    // картинка с другого источника «пачкает» холст и читать его нельзя —
    // тогда просто компилируем как есть, это не повод ронять компиляцию
    return image;
  }

  // Заливаем средним цветом сердцевины, а не белым или чёрным: любой
  // контрастный фон сам стал бы контуром там, где мы контур только что убрали.
  let red = 0;
  let green = 0;
  let blue = 0;
  let counted = 0;
  for (let i = 0; i < pixels.data.length; i += 4) {
    if (depthMap.data[i] >= 247) {
      red += pixels.data[i];
      green += pixels.data[i + 1];
      blue += pixels.data[i + 2];
      counted++;
    }
  }
  if (!counted) return image;
  red /= counted;
  green /= counted;
  blue /= counted;

  for (let i = 0; i < pixels.data.length; i += 4) {
    const keep = keepWeight(depthMap.data[i] / 255);
    if (keep >= 1) continue;
    pixels.data[i] = pixels.data[i] * keep + red * (1 - keep);
    pixels.data[i + 1] = pixels.data[i + 1] * keep + green * (1 - keep);
    pixels.data[i + 2] = pixels.data[i + 2] * keep + blue * (1 - keep);
    // Непрозрачным делаем везде: иначе контур высечки останется перепадом
    // «фон — рисунок» и снова окажется самым сильным признаком в кадре.
    pixels.data[i + 3] = 255;
  }
  outCtx.putImageData(pixels, 0, 0);

  const blob: Blob | null = await new Promise((resolve) =>
    out.toBlob(resolve, 'image/png')
  );
  if (!blob) return image;
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Собирает .mind из картинки-маркера.
 * @param file      исходное изображение сувенира
 * @param onProgress прогресс 0..100
 * @param name      базовое имя итогового файла (обычно slug опыта)
 * @param inset     отступ от краёв для трекинга, доля короткой стороны
 */
export async function compileMindFile(
  file: File,
  onProgress: (percent: number) => void,
  name = 'marker',
  inset = AR_MARKER_TRACK_INSET
): Promise<File> {
  const Compiler = await loadMindArCompilerClass();
  const normalized = await normalizeMarkerImage(file);
  // Втягиваем только то, что уходит в .mind. Сам файл маркера остаётся
  // нетронутым: из него берутся маска высечки и пропорции плоскости контента.
  const image = await insetForTracking(normalized, inset);

  const compiler = new Compiler();
  await compiler.compileImageTargets([image], (percent: number) => {
    onProgress(Math.max(0, Math.min(100, Math.round(percent))));
  });

  const buffer: ArrayBuffer | Uint8Array = compiler.exportData();
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/octet-stream',
  });
  return new File([blob], `${name || 'marker'}.mind`, {
    type: 'application/octet-stream',
  });
}

// Компиляция изображения-маркера в .mind прямо в браузере админки — тот же
// код, что крутится на официальной странице веб-компилятора MindAR, только без
// похода на сторонний сайт и ручного скачивания/загрузки файла.
//
// Почему не CLI-скрипт: офлайн-компилятор MindAR тянет нативный `canvas`
// (node-gyp), который не собирается ни локально на Windows, ни в сборке на
// Vercel — ровно та же причина, по которой mind-ar не стоит npm-зависимостью.
// Браузерная сборка этой проблемы лишена и работает у любого админа.

import { loadMindArCompilerClass } from './config';

// Ограничение длинной стороны маркера перед компиляцией. Больше 1024 px даёт
// заметно более тяжёлый .mind и долгую компиляцию, а на качество трекинга почти
// не влияет — MindAR всё равно строит собственную пирамиду масштабов.
export const AR_MARKER_MAX_SIZE = 1024;

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

/**
 * Собирает .mind из картинки-маркера.
 * @param file      исходное изображение сувенира
 * @param onProgress прогресс 0..100
 * @param name      базовое имя итогового файла (обычно slug опыта)
 */
export async function compileMindFile(
  file: File,
  onProgress: (percent: number) => void,
  name = 'marker'
): Promise<File> {
  const Compiler = await loadMindArCompilerClass();
  const image = await normalizeMarkerImage(file);

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

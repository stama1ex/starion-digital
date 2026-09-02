/* eslint-disable @typescript-eslint/no-explicit-any */
// Загрузка MindAR + three во время выполнения, ТОЛЬКО на странице /ar/[slug].
//
// Почему не npm-зависимость:
//  - mind-ar тянет нативный `canvas` (node-gyp), который не собирается без
//    MSVC-тулчейна и не имеет prebuild под Node 22 (ломает и локальную
//    установку, и сборку на Vercel — там нет cairo/pango);
//  - mind-ar@1.2.5 рассчитан на three ~0.144 (в 0.150+ убрали `sRGBEncoding`),
//    а в проекте three 0.182 для R3F.
//
// Поэтому MindAR и совместимая three@0.144 грузятся динамически с CDN и живут
// изолированно от проектной three — пересечений нет, т.к. AR-сцена отдельная.
// В основной бандл сайта не попадает ничего (webpackIgnore + грузится по клику).
//
// База CDN переопределяется через NEXT_PUBLIC_AR_CDN_BASE, если понадобится
// self-hosting (см. ADMIN_GUIDE).

export const AR_MINDAR_VERSION = '1.2.5';
export const AR_THREE_VERSION = '0.144.0';

const CDN_BASE = process.env.NEXT_PUBLIC_AR_CDN_BASE || 'https://esm.sh';

// URL строятся так, чтобы бандл MindAR и наш прямой импорт three ссылались на
// один и тот же модуль (esm.sh отдаёт /three@0.144.0/es2022/three.mjs) —
// иначе получим две копии three в одной сцене.
export const AR_MINDAR_URL = `${CDN_BASE}/mind-ar@${AR_MINDAR_VERSION}/dist/mindar-image-three.prod.js?deps=three@${AR_THREE_VERSION}&target=es2022`;
export const AR_THREE_URL = `${CDN_BASE}/three@${AR_THREE_VERSION}/es2022/three.mjs`;
export const AR_GLTF_LOADER_URL = `${CDN_BASE}/three@${AR_THREE_VERSION}/es2022/addons/loaders/GLTFLoader.mjs`;

export interface LoadedMindAR {
  MindARThree: any;
  THREE: any;
}

let mindArCache: Promise<LoadedMindAR> | null = null;

// Мемоизированная загрузка — можно дёргать заранее (prefetch на экране-интро),
// повторные вызовы вернут тот же промис.
export function loadMindAr(): Promise<LoadedMindAR> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('MindAR can only load in the browser'));
  }
  if (!mindArCache) {
    mindArCache = (async () => {
      const [mindarMod, threeMod] = await Promise.all([
        import(/* webpackIgnore: true */ AR_MINDAR_URL),
        import(/* webpackIgnore: true */ AR_THREE_URL),
      ]);
      if (!mindarMod?.MindARThree) {
        throw new Error('MindARThree export missing from CDN bundle');
      }
      return { MindARThree: mindarMod.MindARThree, THREE: threeMod };
    })().catch((err) => {
      // не кэшируем неудачу — дать шанс на повторную попытку
      mindArCache = null;
      throw err;
    });
  }
  return mindArCache;
}

let gltfLoaderCache: Promise<any> | null = null;

export function loadGltfLoaderClass(): Promise<any> {
  if (!gltfLoaderCache) {
    gltfLoaderCache = import(/* webpackIgnore: true */ AR_GLTF_LOADER_URL)
      .then((m) => m.GLTFLoader)
      .catch((err) => {
        gltfLoaderCache = null;
        throw err;
      });
  }
  return gltfLoaderCache;
}

// Параметры трекинга MindAR (сглаживание/толерантность к потере маркера).
// Значения из officiальных примеров, чуть смягчены для стабильности картинки.
export const AR_TRACKING_OPTIONS = {
  filterMinCF: 0.0001,
  filterBeta: 0.001,
  missTolerance: 5,
  warmupTolerance: 5,
};

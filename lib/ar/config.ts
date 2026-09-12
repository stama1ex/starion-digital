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

// Домен для QR живёт в lib/ar/domain.ts — он же нужен middleware.

export const AR_MINDAR_VERSION = '1.2.5';
export const AR_THREE_VERSION = '0.144.0';

const CDN_BASE = process.env.NEXT_PUBLIC_AR_CDN_BASE || 'https://esm.sh';

// URL строятся так, чтобы бандл MindAR и наш прямой импорт three ссылались на
// один и тот же модуль (esm.sh отдаёт /three@0.144.0/es2022/three.mjs) —
// иначе получим две копии three в одной сцене.
export const AR_MINDAR_URL = `${CDN_BASE}/mind-ar@${AR_MINDAR_VERSION}/dist/mindar-image-three.prod.js?deps=three@${AR_THREE_VERSION}&target=es2022`;
export const AR_THREE_URL = `${CDN_BASE}/three@${AR_THREE_VERSION}/es2022/three.mjs`;
export const AR_GLTF_LOADER_URL = `${CDN_BASE}/three@${AR_THREE_VERSION}/es2022/addons/loaders/GLTFLoader.mjs`;
// Сборка MindAR без three — нужна только ради класса Compiler (тот самый, что
// крутится на официальной странице веб-компилятора). Грузится в админке по
// требованию, чтобы собирать .mind прямо в браузере.
export const AR_MINDAR_COMPILER_URL = `${CDN_BASE}/mind-ar@${AR_MINDAR_VERSION}/dist/mindar-image.prod.js?target=es2022`;

export interface LoadedMindAR {
  MindARThree: any;
  THREE: any;
}

// Динамический импорт абсолютного CDN-URL. Магические комментарии не дают
// бандлерам (webpack в `next build`, turbopack в `next dev`) пытаться
// зарезолвить URL на этапе сборки — модуль грузит нативный import() в браузере.
function importExternal(url: string): Promise<any> {
  return import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ url
  );
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
        importExternal(AR_MINDAR_URL),
        importExternal(AR_THREE_URL),
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
    gltfLoaderCache = importExternal(AR_GLTF_LOADER_URL)
      .then((m) => m.GLTFLoader)
      .catch((err) => {
        gltfLoaderCache = null;
        throw err;
      });
  }
  return gltfLoaderCache;
}

let compilerCache: Promise<any> | null = null;

// Класс Compiler из браузерной сборки MindAR. Компиляция идёт в Web Worker
// (он инлайнится в бандл), поэтому интерфейс админки не подвисает.
export function loadMindArCompilerClass(): Promise<any> {
  if (!compilerCache) {
    compilerCache = importExternal(AR_MINDAR_COMPILER_URL)
      .then((m) => {
        if (!m?.Compiler) throw new Error('Compiler export missing');
        return m.Compiler;
      })
      .catch((err) => {
        compilerCache = null;
        throw err;
      });
  }
  return compilerCache;
}

// MindAR отвечает за признаки и уточнение позы. Его покомпонентный OneEuro
// оставляем с заводскими настройками для внутреннего якоря, но в нашу сцену
// берём измерение ДО него (mindar-pose-source.ts). Усреднять 16 элементов
// матрицы нельзя: это создаёт shear, ложный масштаб и неединичный quaternion.
export const AR_TRACKING_OPTIONS = {
  filterMinCF: 0.001,
  filterBeta: 1000,
  // Сколько кадров подряд движок может не найти маркер, прежде чем сдаться и
  // уйти обратно в полное распознавание. Дефолт 5 срывался от блика и смаза;
  // на глянцевом магните бликов заметно больше, чем на бумаге или экране.
  // Держим запас, но согласованный с holdMs: дольше, чем мы всё равно
  // показываем последнюю позу, движку тянуть незачем.
  missTolerance: 15,
  warmupTolerance: 3,
};

// Единственный фильтр сцены работает с жёсткой позой, а время измеряет в
// секундах. Частоты — Гц, угловая скорость — рад/с, линейная — ширины
// скомпилированного маркера/с. Размер модели от оценки поворота не зависит.
export const AR_STABILIZER = {
  angleMinCutoffHz: 1,
  depthMinCutoffHz: 1,
  planeMinCutoffHz: 3,
  velocityCutoffHz: 1,
  angleBeta: 3,
  translationBeta: 14,
  // Короткий провал разрешаем по реальному времени, а не суммой 40 кадров
  // движка и 45 кадров экрана. После этого новый захват начинает новую позу.
  // 150 мс хватало на бумаге; на глянцевом магните блик гасит признаки
  // заметно дольше, и контент моргал. 400 мс — примерно столько же кадров,
  // сколько разрешает missTolerance, так что две настройки не спорят.
  holdMs: 400,
};

// Сохраняем адреса для диагностики. armincf по-прежнему задан в 1/мс,
// поэтому здесь переводится в Гц. arbeta теперь относится к угловой скорости
// нормированного quaternion в рад/с, а не к 16 разноразмерным элементам.
export function arPoseOptions() {
  const opts = { ...AR_STABILIZER };
  if (typeof window === 'undefined') return opts;
  const q = new URLSearchParams(window.location.search);
  const numberInRange = (name: string, min: number, max: number) => {
    const raw = q.get(name);
    if (raw === null || raw.trim() === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= min && value <= max ? value : null;
  };
  const beta = numberInRange('arbeta', 0, 100);
  if (beta !== null) opts.angleBeta = beta;
  const minCf = numberInRange('armincf', 0.00001, 0.1);
  if (minCf !== null) opts.angleMinCutoffHz = minCf * 1000;
  return opts;
}
// Разрешение камеры с переопределением из адреса: /ar/{slug}?arres=1920.
// Нужно ровно для того случая, когда сувенир маленький. MindAR ведёт трекинг
// по шаблонам с короткой стороной 256 и 128 px (buildTrackingImageList в
// компиляторе), и решает не размер .mind, а сколько пикселей кадра занимает
// сам сувенир. Магнит с руки занимает их в разы меньше, чем та же картинка на
// мониторе, — отсюда и разница в качестве привязки. Больше пикселей камеры =
// больше признаков, но дороже каждый кадр: смотреть по строке «трекинг N/с».
export function arCameraConstraints(): MediaTrackConstraints {
  const constraints = { ...AR_CAMERA_CONSTRAINTS };
  if (typeof window === 'undefined') return constraints;
  const raw = new URLSearchParams(window.location.search).get('arres');
  const width = Number(raw);
  if (Number.isFinite(width) && width >= 480 && width <= 3840) {
    constraints.width = { ideal: Math.round(width) };
    constraints.height = { ideal: Math.round((width * 9) / 16) };
  }
  return constraints;
}

// Разрешение, которое просим у камеры. MindAR своих опций для этого не даёт и
// запрашивает поток только по facingMode — Android на этом отдавал 480x640
// (0.3 МП), чего мало для image-tracking: мало точек-признаков => грубая и
// «плавающая» привязка.
//
// Компромисс: выше разрешение — точнее поза, но дороже обработка каждого кадра,
// то есть ниже частота обновления трекинга и визуально больше запаздывание.
// Если на слабом телефоне контент начнёт двигаться рывками — снижать до
// 960x540 или 640x480.
export const AR_CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30 },
  // Автофокус — отдельная и частая причина срывов: телефон переводит фокус на
  // фон, кадр уплывает, признаки перестают находиться. Просим непрерывный
  // режим. Свойство нестандартное, поэтому идёт в advanced: браузер, который
  // его не знает, молча пропустит пункт, а не отвергнет весь запрос.
  // Свойства нестандартные и в типах lib.dom отсутствуют — отсюда приведение.
  advanced: [
    { focusMode: 'continuous' },
    { exposureMode: 'continuous' },
    { whiteBalanceMode: 'continuous' },
  ] as unknown as MediaTrackConstraintSet[],
};

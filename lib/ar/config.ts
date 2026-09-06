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

// Параметры сглаживания позы маркера (OneEuroFilter внутри MindAR).
// Формула фильтра: cutOff = filterMinCF + filterBeta * |скорость|, и чем выше
// cutOff, тем ближе контент к «сырой» позе (меньше лага, больше дрожания).
//
// Дефолты MindAR — 0.001 / 1000; официальный three.js-пример использует
// 1 / 10000 (почти без сглаживания). Здесь середина, смещённая в сторону
// отзывчивости, потому что при быстром повороте магнита видео заметно
// отставало:
//  - filterMinCF — сглаживание в покое: выше => контент быстрее «садится» на
//    маркер, но сильнее дрожит, когда держишь неподвижно;
//  - filterBeta — насколько фильтр ускоряется при движении: выше => контент
//    почти не отстаёт, когда маркер двигают или крутят.
//
// Если начнёт дрожать на неподвижном маркере — снижать filterMinCF (0.01,
// 0.005). Если всё ещё отстаёт при движении — поднимать filterBeta.
export const AR_TRACKING_OPTIONS = {
  // cutOff = filterMinCF + filterBeta * |скорость|; чем ниже cutOff, тем
  // сильнее сглаживание. В покое скорость ~0, поэтому за дрожание на
  // неподвижном маркере отвечает именно filterMinCF. Держим его низким —
  // основную работу делает этот адаптивный фильтр, а наш слой лишь добавляет
  // демпфирование поворота и удержание при срыве.
  filterMinCF: 0.001,
  // Скорость при движении: выше дефолта (1000), чтобы контент не отставал,
  // когда сувенир двигают или поворачивают в руке.
  filterBeta: 5000,
  // Сколько кадров подряд маркер должен теряться, прежде чем движок сочтёт
  // его потерянным. Дефолт 5 — срывалось от блика, наклона и смаза.
  missTolerance: 40,
  warmupTolerance: 3,
};

// Наш слой поверх фильтра движка.
//
// Мёртвой зоны здесь намеренно нет. Порог не убирает дрожание, а квантует
// его: пока расхождение меньше порога, контент стоит; как только шум порог
// превысил — контент подтягивается, расхождение снова падает ниже порога, и
// всё повторяется. Выходит автоколебание с амплитудой ровно в размер порога,
// то есть плавное подрагивание превращается в ступенчатое. Вместо порога —
// плавное следование, скорость которого растёт с величиной расхождения:
// шум остаётся почти неподвижным, реальное движение проходит быстро.
// Наш слой поверх фильтра движка.
//
// Мёртвой зоны здесь намеренно нет: порог не убирает дрожание, а квантует его —
// пока расхождение меньше порога, контент стоит; как только шум порог превысил,
// контент подтягивается и расхождение снова падает ниже порога. Выходит
// автоколебание с амплитудой ровно в размер порога.
//
// Главное здесь — разное отношение к разным частям позы. MindAR подбирает
// гомографию: плоское преобразование, которое кладёт картинку маркера на кадр.
// Оно определяется очень точно, поэтому видео, лежащее в плоскости маркера,
// приклеено идеально. А вот полная пространственная поза получается
// разложением этой гомографии, и разложение неустойчиво: множество разных
// наклонов и расстояний дают почти одинаковую гомографию. Шумят именно наклон
// плоскости и глубина — то, что видео не замечает, а стоящая над плоскостью
// модель показывает во всей красе.
//
// Поэтому поворот раскладывается на две части относительно нормали маркера:
// twist (поворот в плоскости, определяется однозначно) идёт быстро, swing
// (наклон плоскости к камере) — медленно. Глубина и масштаб тоже медленно.
export const AR_STABILIZER = {
  // Сдвиг в плоскости маркера — часть позы, определённая надёжно.
  followMin: 0.14,
  // Поворот в плоскости маркера: тоже надёжен, можно следовать быстро.
  followTwist: 0.14,
  // Наклон плоскости и глубина — та самая шумная часть.
  followSwing: 0.05,
  followDepth: 0.05,
  followMax: 1,
  speedGain: 14,
  // Для видео жёсткое сглаживание наклона вредно: оно лежит в плоскости
  // маркера, и при быстром наклоне запаздывание видно как сползание с
  // сувенира. Там наклон ведём почти без сглаживания.
  videoSwing: 0.5,
  videoDepth: 0.5,
  // Сколько кадров держать последнюю позу после потери маркера (~0.7 c).
  holdFrames: 45,
};
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

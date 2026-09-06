/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef } from 'react';
import {
  loadMindAr,
  loadGltfLoaderClass,
  AR_TRACKING_OPTIONS,
  AR_STABILIZER,
  AR_CAMERA_CONSTRAINTS,
} from '@/lib/ar/config';
import { arAssetUrl } from '@/lib/ar/types';
import type { ARExperienceClient } from '@/lib/ar/types';
import type { ARErrorKind } from './ar-errors';

interface ARStageProps {
  experience: ARExperienceClient;
  soundOn: boolean;
  audioTrackIndex: number;
  onSoundBlocked: () => void;
  onProgress: (value: number) => void;
  onScanning: () => void;
  onTargetFound: () => void;
  onTargetLost: () => void;
  onError: (kind: ARErrorKind) => void;
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('marker image failed'));
    img.src = src;
  });
}

// Есть ли у картинки заметная прозрачность. Нужно, чтобы понять, фигурный
// сувенир или прямоугольный: у высечки (PNG с прозрачным фоном) альфа сама
// задаёт силуэт, и отдельную маску грузить не нужно. Считаем на уменьшенной
// копии — точность тут не важна, важен сам факт.
function hasTransparency(img: HTMLImageElement): boolean {
  try {
    const w = 64;
    const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * 64));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 8) transparent++;
    return transparent / (w * h) > 0.01;
  } catch {
    return false; // не смогли прочитать пиксели — считаем прямоугольным
  }
}

// Видимая область вьюпорта в CSS-пикселях. На мобильных `100vh` / `fixed
// inset-0` считаются от «большого» вьюпорта (как если бы адресная строка была
// спрятана), а visualViewport даёт то, что реально видит пользователь — именно
// этот размер должен получить контейнер MindAR, иначе камера и canvas
// разъезжаются (полосы по краям + сбитая привязка контента к маркеру).
function viewportSize() {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  const w = Math.round(vv?.width ?? window.innerWidth);
  const h = Math.round(vv?.height ?? window.innerHeight);
  return { w, h };
}

/**
 * Голая интеграция MindAR + three (не R3F — MindAR требует прямого доступа к
 * сцене/камере). Монтируется только после того, как пользователь нажал «Навести
 * камеру» и разрешение на камеру уже получено (prime в ARViewer). Весь MindAR и
 * изолированная three@0.144 подгружаются с CDN здесь же — в основной бандл сайта
 * не попадают.
 */
export default function ARStage({
  experience,
  soundOn,
  audioTrackIndex,
  onSoundBlocked,
  onProgress,
  onScanning,
  onTargetFound,
  onTargetLost,
  onError,
}: ARStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const debugRef = useRef<HTMLPreElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  // индекс держим в ref: init-эффект читает его один раз при старте и не должен
  // пересоздавать сцену, когда пользователь переключает язык
  const audioTrackIndexRef = useRef(audioTrackIndex);
  audioTrackIndexRef.current = audioTrackIndex;
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;
  const onSoundBlockedRef = useRef(onSoundBlocked);
  onSoundBlockedRef.current = onSoundBlocked;
  // Заполняется при инициализации сцены: снаружи её нет, а применять звук
  // нужно и по кнопке, и в момент, когда медиаэлемент только что создан.
  const applySoundRef = useRef<(() => void) | null>(null);
  const mixerRef = useRef<any>(null);
  const isTrackingRef = useRef(false);

  // колбэки в ref — чтобы init-эффект не переинициализировался при ре-рендерах
  const cbRef = useRef({
    onProgress,
    onScanning,
    onTargetFound,
    onTargetLost,
    onError,
  });
  cbRef.current = {
    onProgress,
    onScanning,
    onTargetFound,
    onTargetLost,
    onError,
  };

  useEffect(() => {
    let cancelled = false;
    let mindarThree: any = null;
    let renderer: any = null;
    let scene: any = null;
    const disposables: Array<() => void> = [];

    // Панель диагностики раскладки — выключена, включается только вручную:
    // /ar/{slug}?ardebug=1. Пригодится, если на каком-то устройстве кадр
    // камеры снова поедет: показывает реальные размеры вьюпорта, контейнера,
    // видео и canvas, а также fov/aspect камеры и габариты плоскости контента.
    const debugOn =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('ardebug');

    // Жёстко задаём контейнеру размер видимой области в px. Без этого MindAR
    // меряет clientWidth/clientHeight от вьюпорт-юнитов, которые на мобильных
    // не совпадают с видимой областью — отсюда полосы и сдвиг привязки.
    const syncContainerSize = () => {
      const el = containerRef.current;
      if (!el) return;
      const { w, h } = viewportSize();
      if (w < 2 || h < 2) return;
      if (el.style.width !== w + 'px') el.style.width = w + 'px';
      if (el.style.height !== h + 'px') el.style.height = h + 'px';
    };

    const renderDebug = () => {
      const box = debugRef.current;
      if (!debugOn || !box) return;
      box.style.display = 'block';
      const el = containerRef.current;
      const v: HTMLVideoElement | undefined = mindarThree?.video;
      const c: HTMLCanvasElement | undefined = renderer?.domElement;
      const cam = mindarThree?.camera;
      const { w, h } = viewportSize();
      const bad =
        (v?.style.width || '').includes('NaN') ||
        (v?.style.height || '').includes('NaN');
      box.textContent = [
        'ardebug v6' + (bad ? '   !! NaN in video css !!' : ''),
        'vv        ' + w + 'x' + h + '  dpr ' + window.devicePixelRatio,
        'inner     ' + window.innerWidth + 'x' + window.innerHeight,
        'container ' + el?.clientWidth + 'x' + el?.clientHeight,
        'video css ' +
          (v?.style.width || '-') +
          ' x ' +
          (v?.style.height || '-') +
          ' @ ' +
          (v?.style.left || '-') +
          ',' +
          (v?.style.top || '-'),
        'video src ' + (v?.videoWidth || 0) + 'x' + (v?.videoHeight || 0),
        'canvas    ' + (c?.style.width || '-') + ' x ' + (c?.style.height || '-'),
        'camera    fov ' +
          (cam?.fov?.toFixed ? cam.fov.toFixed(2) : '-') +
          ' aspect ' +
          (cam?.aspect?.toFixed ? cam.aspect.toFixed(3) : '-'),
        'resizes   ' +
          resizeCount +
          (lastResizeError ? '  ERR ' + lastResizeError : ''),
        'video box ' +
          (v
            ? Math.round(v.getBoundingClientRect().width) +
              'x' +
              Math.round(v.getBoundingClientRect().height) +
              ' fit ' +
              getComputedStyle(v).objectFit
            : '-'),
        ...Object.entries(debugInfo).map(
          ([k, val]) => k.padEnd(10, ' ') + val
        ),
      ].join('\n');
    };

    // resize() у MindAR пересоздаёт буфер рендера, а visualViewport 'scroll'
    // сыплется пачками — дёргаем только когда размер реально поменялся.
    let lastW = 0;
    let lastH = 0;
    let resizeCount = 0;
    let lastResizeError = '';
    // произвольные строки для панели ?ardebug=1
    const debugInfo: Record<string, string> = {};
    const syncAndResize = (force = false) => {
      if (cancelled) return;
      syncContainerSize();
      const { w, h } = viewportSize();
      if (!force && w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      try {
        mindarThree?.resize();
        resizeCount++;
      } catch (err: any) {
        // молчаливый провал resize() = камера навсегда с неправильным кадром,
        // поэтому показываем причину в панели диагностики
        lastResizeError = String(err?.message || err);
        console.error('[AR] mindar resize failed', err);
      }
      renderDebug();
    };
    const forceResize = () => syncAndResize(true);

    async function init() {
      const cb = cbRef.current;
      cb.onProgress(0.05);

      if (!hasWebGL()) {
        cb.onError('webgl');
        return;
      }

      // Размер контейнера выставляем ДО создания MindARThree, чтобы самый
      // первый внутренний resize() внутри start() увидел правильные размеры.
      syncContainerSize();

      let MindARThree: any;
      let THREE: any;
      try {
        ({ MindARThree, THREE } = await loadMindAr());
      } catch (err) {
        console.error('[AR] MindAR load failed', err);
        cb.onError('mindar');
        return;
      }
      if (cancelled) return;
      cb.onProgress(0.25);
      syncContainerSize();

      const { slug, version } = experience;

      // MindAR вешает свой resize-слушатель на window прямо в конструкторе и
      // нигде его не снимает — ссылку на bound-функцию он не хранит, поэтому
      // сами снять её потом нельзя. Без этого каждый монтаж вьюера навсегда
      // удерживает всю AR-сцену. Перехватываем регистрацию, чтобы снять при
      // размонтировании.
      const captured: Array<[string, EventListenerOrEventListenerObject]> = [];
      const originalAddEventListener = window.addEventListener.bind(window);
      window.addEventListener = ((
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
      ) => {
        captured.push([type, listener]);
        return originalAddEventListener(type, listener, options);
      }) as typeof window.addEventListener;

      try {
        mindarThree = new MindARThree({
          container: containerRef.current,
          imageTargetSrc: arAssetUrl(slug, 'mind', version),
          uiLoading: 'no',
          uiScanning: 'no',
          uiError: 'no',
          maxTrack: 1,
          ...AR_TRACKING_OPTIONS,
        });
      } catch (err) {
        console.error('[AR] MindARThree ctor failed', err);
        cb.onError('unknown');
        return;
      } finally {
        window.addEventListener = originalAddEventListener;
      }
      disposables.push(() => {
        for (const [type, listener] of captured) {
          window.removeEventListener(type, listener);
        }
      });

      renderer = mindarThree.renderer;
      scene = mindarThree.scene;
      const camera = mindarThree.camera;

      // MindAR ставит pixelRatio = devicePixelRatio (на телефоне это 3), то есть
      // прозрачный оверлей рисуется в родном разрешении панели — 2.6 Мпикс,
      // которые каждый кадр чистятся и вычитываются композитором ради одного
      // квада. Ограничиваем: раскладка и привязка не затрагиваются, потому что
      // resize() у MindAR считает fov/aspect только из CSS-размеров контейнера,
      // а setSize сам домножает на pixelRatio.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      // Свет для 3D-контента (для VIDEO не мешает — там MeshBasicMaterial)
      const hemi = new THREE.HemisphereLight(0xffffff, 0xbbc4d4, 1.15);
      const key = new THREE.DirectionalLight(0xffffff, 1.5);
      key.position.set(0.6, 1.2, 1.4);
      const fill = new THREE.DirectionalLight(0xffffff, 0.6);
      fill.position.set(-0.8, -0.4, 0.9);
      scene.add(hemi, key, fill);

      const anchor = mindarThree.addAnchor(0);

      // Контент живёт не на группе MindAR, а на своей. Движок каждый кадр
      // пишет в anchor.group сырую оценку позы со всем её шумом, и если
      // подвесить контент туда, этот шум видно один в один. Наша группа
      // подтягивается к позе маркера в цикле рендера — с мёртвой зоной,
      // адаптивным следованием и удержанием при кратком срыве.
      const stage = new THREE.Group();
      stage.matrixAutoUpdate = false;
      stage.visible = false;
      scene.add(stage);
      disposables.push(() => {
        scene.remove(stage);
      });

      let startAnimations: (() => void) | null = null;
      try {
        startAnimations = await buildContent({
          THREE,
          contentGroup: stage,
          experience,
          videoElRef,
          mixerRef,
          disposables,
          debugInfo,
          onAssetProgress: (p: number) =>
            cb.onProgress(0.25 + Math.max(0, Math.min(1, p)) * 0.45),
        });
      } catch (err) {
        console.error('[AR] content build failed', err);
        cb.onError('asset');
        return;
      }
      if (cancelled) return;
      cb.onProgress(0.7);

      // Материал компилируется лениво — в первом кадре, где меш реально
      // отрисован, то есть ровно в момент захвата маркера. В three r144 линковка
      // сопровождается блокирующим getProgramParameter, и на Android это
      // 30-150 мс рывка именно там, где нужна плавность. Компилируем заранее.
      try {
        const wasVisible = stage.visible;
        stage.visible = true;
        renderer.compile(scene, camera);
        stage.visible = wasVisible;
      } catch (err) {
        console.warn('[AR] shader precompile skipped', err);
      }

      // Озвучка отдельной дорожкой. Если дорожки заданы, звук видео глушится
      // навсегда (см. buildContent) и слышно только выбранный язык — иначе они
      // накладывались бы друг на друга.
      if (experience.audioTracks.length > 0) {
        const audio = document.createElement('audio');
        audio.preload = 'auto';
        audio.loop = experience.loop;
        audio.muted = true; // как и видео: звук включает только жест пользователя
        audio.setAttribute('playsinline', '');
        audio.src = arAssetUrl(
          slug,
          'audio',
          version,
          Math.max(0, audioTrackIndexRef.current)
        );
        audio.load();
        audioElRef.current = audio;
        disposables.push(() => {
          try {
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
          } catch {}
          audioElRef.current = null;
        });
      }

      // Звук включается не только кнопкой: медиаэлемент создаётся уже после
      // монтирования, и состояние звука надо применить к нему при появлении.
      const applySound = () => {
        const media = experience.audioTracks.length
          ? audioElRef.current
          : videoElRef.current;
        if (!media) return;
        const want = soundOnRef.current;
        media.muted = !want;
        if (!want || !isTrackingRef.current) return;

        const started = media.play();
        started?.catch?.(() => {
          // Браузер не пустил звук без жеста. Возвращаем немой режим —
          // иначе видео не запустится вовсе, — и сообщаем наружу, чтобы
          // кнопка показывала правду и следующий тап сработал.
          media.muted = true;
          media.play().catch(() => {});
          onSoundBlockedRef.current();
        });
      };
      applySoundRef.current = applySound;
      disposables.push(() => {
        applySoundRef.current = null;
      });

      anchor.onTargetFound = () => {
        isTrackingRef.current = true;
        cb.onTargetFound();
        if (experience.autoplay) {
          videoElRef.current?.play().catch(() => {});
          audioElRef.current?.play().catch(() => {});
          startAnimations?.();
        }
        // после старта воспроизведения — снять немой режим, если звук нужен
        applySound();
      };
      anchor.onTargetLost = () => {
        isTrackingRef.current = false;
        cb.onTargetLost();
        videoElRef.current?.pause();
        audioElRef.current?.pause();
      };

      // У MindAR нет опции разрешения камеры — он запрашивает поток только по
      // facingMode. На время start() подмешиваем желаемое разрешение в
      // getUserMedia (см. AR_CAMERA_CONSTRAINTS) и сразу возвращаем оригинал.
      const media = navigator.mediaDevices;
      const originalGetUserMedia = media.getUserMedia.bind(media);
      media.getUserMedia = (constraints?: MediaStreamConstraints) => {
        if (constraints?.video && typeof constraints.video === 'object') {
          Object.assign(constraints.video, AR_CAMERA_CONSTRAINTS);
        }
        return originalGetUserMedia(constraints);
      };

      try {
        await mindarThree.start();
      } catch (err: any) {
        console.error('[AR] mindar start failed', err);
        cb.onError(classifyStartError(err));
        return;
      } finally {
        media.getUserMedia = originalGetUserMedia;
      }
      if (cancelled) {
        try {
          mindarThree.stop();
        } catch {}
        return;
      }

      // MindAR меряет контейнер один раз внутри start(). На мобильных к этому
      // моменту вьюпорт ещё «прыгает» (адресная строка), поэтому пере-меряем
      // многократно: сразу, по кадру, по таймерам и на все события вьюпорта.
      forceResize();
      requestAnimationFrame(forceResize);
      const timers = [100, 300, 800, 1600, 3000].map((ms) =>
        setTimeout(forceResize, ms)
      );
      disposables.push(() => timers.forEach(clearTimeout));

      // Некоторые Android-браузеры отдают videoWidth=0 в тот момент, когда
      // MindAR делает свой единственный resize() внутри start(). Тогда он
      // считает videoRatio = NaN, пишет в стили видео 'NaNpx' — браузер их
      // игнорирует, и камера навсегда остаётся полосой, а FOV сбит. Ждём
      // реальные размеры и пересчитываем.
      let dimTries = 0;
      const waitForVideoDims = () => {
        if (cancelled) return;
        const v: HTMLVideoElement | undefined = mindarThree?.video;
        if (v && v.videoWidth > 0 && v.videoHeight > 0) {
          forceResize();
          return;
        }
        if (dimTries++ < 60) {
          const id = setTimeout(waitForVideoDims, 100);
          disposables.push(() => clearTimeout(id));
        }
      };
      waitForVideoDims();

      // видео камеры получает реальные размеры асинхронно — на каждое событие
      // пересчитываем раскладку и FOV
      const camVideo: HTMLVideoElement | undefined = mindarThree.video;
      if (camVideo) {
        const events: Array<keyof HTMLVideoElementEventMap> = [
          'loadedmetadata',
          'playing',
          'resize',
        ];
        for (const ev of events) {
          camVideo.addEventListener(ev, forceResize);
          disposables.push(() =>
            camVideo.removeEventListener(ev, forceResize)
          );
        }
      }

      window.addEventListener('orientationchange', forceResize);
      window.addEventListener('resize', forceResize);
      disposables.push(() => {
        window.removeEventListener('orientationchange', forceResize);
        window.removeEventListener('resize', forceResize);
      });

      const vv = window.visualViewport;
      if (vv) {
        const onVv = () => syncAndResize();
        vv.addEventListener('resize', onVv);
        vv.addEventListener('scroll', onVv);
        disposables.push(() => {
          vv.removeEventListener('resize', onVv);
          vv.removeEventListener('scroll', onVv);
        });
      }

      if (containerRef.current && 'ResizeObserver' in window) {
        const ro = new ResizeObserver(() => {
          try {
            mindarThree?.resize();
          } catch {}
          renderDebug();
        });
        ro.observe(containerRef.current);
        disposables.push(() => ro.disconnect());
      }

      cb.onProgress(1);
      cb.onScanning();

      const clock = new THREE.Clock();

      // Рабочие объекты стабилизатора — создаём один раз, а не каждый кадр
      const targetPos = new THREE.Vector3();
      const targetQuat = new THREE.Quaternion();
      const targetScale = new THREE.Vector3(1, 1, 1);
      const posePos = new THREE.Vector3();
      const poseQuat = new THREE.Quaternion();
      const poseScale = new THREE.Vector3(1, 1, 1);
      // рабочие кватернионы для разложения поворота на twist/swing
      const tTwist = new THREE.Quaternion();
      const tSwing = new THREE.Quaternion();
      const cTwist = new THREE.Quaternion();
      const cSwing = new THREE.Quaternion();
      const tmpQ = new THREE.Quaternion();
      // Видео лежит в плоскости маркера, и сильное сглаживание наклона там
      // видно как сползание. Модель стоит над плоскостью — ей наоборот нужно.
      const flat = experience.contentType === 'VIDEO';
      const swingRate = flat
        ? AR_STABILIZER.videoSwing
        : AR_STABILIZER.followSwing;
      const depthRate = flat
        ? AR_STABILIZER.videoDepth
        : AR_STABILIZER.followDepth;

      // Разложение поворота относительно нормали маркера (его локальная +Z):
      // q = swing * twist, где twist — вращение вокруг нормали.
      const splitPose = (q: any, twist: any, swing: any) => {
        twist.set(0, 0, q.z, q.w);
        if (twist.lengthSq() < 1e-8) {
          twist.set(0, 0, 0, 1);
        } else {
          twist.normalize();
        }
        swing.copy(q).multiply(tmpQ.copy(twist).invert());
      };
      let hasPose = false;
      let lostFrames = 0;
      let stabTick = 0;
      // ?arraw=1 — отключить стабилизацию и смотреть сырую позу движка.
      // Нужно, чтобы сравнить «до и после» на живом сувенире.
      const rawMode =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('arraw') === '1';

      const followPose = () => {
        const g = anchor.group;
        // MindAR может писать матрицу напрямую (matrixAutoUpdate=false) либо
        // выставлять position/quaternion — во втором случае матрицу надо
        // пересобрать самим, иначе прочитаем прошлый кадр.
        if (g.matrixAutoUpdate) g.updateMatrix();
        g.matrix.decompose(targetPos, targetQuat, targetScale);
        if (!Number.isFinite(targetPos.x) || !Number.isFinite(targetScale.x)) {
          return false;
        }

        if (!hasPose || rawMode) {
          posePos.copy(targetPos);
          poseQuat.copy(targetQuat);
          poseScale.copy(targetScale);
          splitPose(poseQuat, cTwist, cSwing);
          hasPose = true;
        } else {
          // Скорость сближения растёт с величиной расхождения: шум (доли
          // процента ширины маркера) почти не двигает контент, а реальное
          // движение руки отрабатывается за пару кадров. Порога нет намеренно
          // — см. комментарий у AR_STABILIZER.
          const dist = posePos.distanceTo(targetPos);
          const ang = poseQuat.angleTo(targetQuat);
          const speed = dist * AR_STABILIZER.speedGain + ang * 2;
          const boost = 1 + speed * 6;
          const clamp = (v: number) => Math.min(AR_STABILIZER.followMax, v);

          const k = clamp(AR_STABILIZER.followMin * boost);
          const kTwist = clamp(AR_STABILIZER.followTwist * boost);
          const kSwing = clamp(swingRate * boost);
          const kDepth = clamp(depthRate * boost);

          // Сдвиг в плоскости маркера — быстро, глубина — медленно.
          posePos.x += (targetPos.x - posePos.x) * k;
          posePos.y += (targetPos.y - posePos.y) * k;
          posePos.z += (targetPos.z - posePos.z) * kDepth;

          // Поворот: в плоскости быстро, наклон плоскости медленно.
          splitPose(targetQuat, tTwist, tSwing);
          cTwist.slerp(tTwist, kTwist);
          cSwing.slerp(tSwing, kSwing);
          poseQuat.copy(cSwing).multiply(cTwist);

          // Масштаб идёт вместе с глубиной — они об одном и том же.
          poseScale.lerp(targetScale, kDepth);
        }

        stage.matrix.compose(posePos, poseQuat, poseScale);
        stage.matrixWorldNeedsUpdate = true;
        return true;
      };
      // Пока маркер не найден, сцена пуста, но кадр всё равно чистился и
      // вычитывался композитором — это отнимало время у распознавания, которое
      // крутится в том же rAF. Рисуем только когда есть что показать; ещё пара
      // кадров после потери маркера нужна, чтобы стереть последний показанный
      // (при preserveDrawingBuffer=false композитор иначе держит старую картинку).
      let flushFrames = 2;
      let syncTick = 0;
      renderer.setAnimationLoop(() => {
        const delta = clock.getDelta();

        // Поза обновляется, пока движок держит маркер; после потери держим
        // последнюю ещё несколько кадров — короткие провалы при наклоне и
        // бликах иначе читаются как обрыв.
        const tracked = anchor.group.visible;
        if (tracked) {
          followPose();
          lostFrames = 0;
        } else if (hasPose) {
          lostFrames++;
        }
        const hold = rawMode ? 0 : AR_STABILIZER.holdFrames;
        const visible = hasPose && (tracked || lostFrames <= hold);
        stage.visible = visible;

        // раз в ~четверть секунды пишем в панель, что делает стабилизатор
        if (debugOn && ++stabTick >= 15) {
          stabTick = 0;
          debugInfo.track =
            (rawMode ? 'СЫРАЯ ПОЗА' : 'стабилизация') +
            ' | ' +
            (tracked
              ? 'маркер в кадре'
              : 'удержание ' + lostFrames + '/' + hold);
        }

        if (visible) {
          if (mixerRef.current) mixerRef.current.update(delta);
          // Видео и озвучка — два независимых элемента и со временем расходятся.
          // Раз в ~секунду подтягиваем дорожку к видео, если разбежались заметно.
          if (++syncTick >= 60) {
            syncTick = 0;
            const a = audioElRef.current;
            const v = videoElRef.current;
            if (a && v && !v.paused && !a.paused && v.duration) {
              if (Math.abs(a.currentTime - v.currentTime) > 0.3) {
                a.currentTime = v.currentTime;
              }
            }
          }
          flushFrames = 2;
        } else if (flushFrames <= 0) {
          return;
        } else {
          flushFrames--;
        }
        renderer.render(scene, camera);
      });

      if (debugOn) {
        const iv = setInterval(renderDebug, 1000);
        disposables.push(() => clearInterval(iv));
        renderDebug();
      }
    }

    init().catch((err) => {
      if (cancelled) return;
      console.error('[AR] init failed', err);
      cbRef.current.onError('unknown');
    });

    return () => {
      cancelled = true;
      try {
        renderer?.setAnimationLoop(null);
      } catch {}
      // останавливает обработку видео, глушит все треки MediaStream и убирает
      // <video> из DOM — камера гаснет
      try {
        mindarThree?.stop();
      } catch {}
      try {
        mixerRef.current?.stopAllAction?.();
      } catch {}
      mixerRef.current = null;

      const video = videoElRef.current;
      if (video) {
        try {
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch {}
        videoElRef.current = null;
      }

      for (const dispose of disposables) {
        try {
          dispose();
        } catch {}
      }
      try {
        scene?.traverse((obj: any) => {
          obj.geometry?.dispose?.();
          const mat = obj.material;
          if (mat) {
            (Array.isArray(mat) ? mat : [mat]).forEach((m: any) => {
              m.map?.dispose?.();
              m.dispose?.();
            });
          }
        });
      } catch {}
      try {
        renderer?.dispose();
        renderer?.forceContextLoss?.();
      } catch {}
    };
    // experience.slug / version фиксируют личность опыта; остальные поля читаются
    // из свежего объекта в init через замыкание на первый рендер — это ок, опыт
    // на странице не меняется без перезагрузки
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experience.slug, experience.version]);

  // Кнопка звука: применяем состояние к уже созданному элементу. Сам вызов
  // приходит из обработчика клика, то есть это пользовательский жест —
  // браузер такое воспроизведение пропускает.
  const hasAudioTracks = experience.audioTracks.length > 0;
  useEffect(() => {
    applySoundRef.current?.();
  }, [soundOn, hasAudioTracks]);

  // Переключение языка озвучки: подменяем источник, сохраняя позицию
  // воспроизведения, чтобы фраза не начиналась заново.
  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;
    const next = arAssetUrl(
      experience.slug,
      'audio',
      experience.version,
      audioTrackIndex
    );
    if (audio.getAttribute('src') === next) return;

    const resumeAt = audio.currentTime;
    const wasPlaying = !audio.paused;
    const onReady = () => {
      audio.removeEventListener('loadedmetadata', onReady);
      if (Number.isFinite(resumeAt) && resumeAt > 0) {
        try {
          audio.currentTime = Math.min(resumeAt, audio.duration || resumeAt);
        } catch {}
      }
      if (wasPlaying) audio.play().catch(() => {});
    };
    audio.addEventListener('loadedmetadata', onReady);
    audio.src = next;
    audio.load();
    return () => audio.removeEventListener('loadedmetadata', onReady);
  }, [audioTrackIndex, experience.slug, experience.version]);

  return (
    <>
      {/* fixed + явные px-размеры из visualViewport (см. syncContainerSize) */}
      <div
        ref={containerRef}
        className="ar-stage fixed left-0 top-0 overflow-hidden"
        style={{ width: '100vw', height: '100vh' }}
      />
      {/* диагностика раскладки: открыть /ar/{slug}?ardebug=1 */}
      <pre
        ref={debugRef}
        className="pointer-events-none fixed left-1 top-14 z-40 max-w-[98vw] whitespace-pre rounded bg-black/85 px-2 py-1 text-[11px] font-bold leading-snug text-lime-300"
        style={{ display: 'none' }}
      />
    </>
  );
}

// ---- построение контента по типу ------------------------------------------

/**
 * Строит контент опыта в группе якоря MindAR.
 * Возвращает функцию запуска анимаций (для ANIMATION) либо null.
 *
 * Система координат группы якоря: маркер — плоскость шириной 1 в плоскости XY,
 * центр в начале координат, +Z смотрит наружу из маркера.
 */
async function buildContent({
  THREE,
  contentGroup,
  experience,
  videoElRef,
  mixerRef,
  disposables,
  debugInfo,
  onAssetProgress,
}: {
  THREE: any;
  contentGroup: any;
  experience: ARExperienceClient;
  videoElRef: React.MutableRefObject<HTMLVideoElement | null>;
  mixerRef: React.MutableRefObject<any>;
  disposables: Array<() => void>;
  debugInfo: Record<string, string>;
  onAssetProgress: (p: number) => void;
}): Promise<(() => void) | null> {
  const { slug, version, contentType } = experience;

  const applyTransform = (obj: any) => {
    obj.scale.multiplyScalar(experience.scale || 1);
    obj.rotation.set(
      experience.rotationX || 0,
      experience.rotationY || 0,
      experience.rotationZ || 0
    );
    obj.position.set(
      experience.offsetX || 0,
      experience.offsetY || 0,
      experience.offsetZ || 0
    );
  };

  if (contentType === 'VIDEO') {
    const video = document.createElement('video');
    video.src = arAssetUrl(slug, 'content', version);
    video.crossOrigin = 'anonymous';
    video.loop = experience.loop;
    // Старт всегда без звука (autoplay-политика iOS). Если заданы озвучки,
    // видео остаётся немым навсегда — звук идёт из выбранной дорожки.
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'auto';

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('video load timeout')),
        30000
      );
      const done = () => {
        clearTimeout(timeout);
        video.removeEventListener('loadeddata', done);
        resolve();
      };
      video.addEventListener('loadeddata', done);
      video.addEventListener(
        'error',
        () => {
          clearTimeout(timeout);
          reject(new Error('video load failed'));
        },
        { once: true }
      );
      video.load();
    });
    onAssetProgress(0.6);

    const markerImage = await loadImage(
      arAssetUrl(slug, 'marker', version)
    ).catch(() => null);

    const markerAspect = markerImage?.naturalHeight
      ? markerImage.naturalWidth / markerImage.naturalHeight
      : (() => {
          const va = video.videoWidth / video.videoHeight;
          return Number.isFinite(va) && va > 0 ? va : 1;
        })();

    // В системе координат MindAR ширина маркера = 1
    const width = 1;
    const height = 1 / markerAspect;
    debugInfo.marker = 'aspect ' + markerAspect.toFixed(3);
    debugInfo.plane =
      width.toFixed(2) +
      'x' +
      height.toFixed(2) +
      ' scale ' +
      (experience.scale || 1);

    const texture = new THREE.VideoTexture(video);
    if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
    else texture.encoding = THREE.sRGBEncoding;

    // Обрезка видео по силуэту фигурного сувенира.
    //
    // По умолчанию маской работает альфа САМОГО маркера: у высечки (PNG с
    // прозрачным фоном) она и есть силуэт, а грузить один и тот же файл дважды
    // незачем. У прямоугольного маркера прозрачности нет — обрезка не нужна,
    // и мы её просто не включаем, не платя за лишнюю текстуру и прозрачный
    // проход рендера.
    //
    // Отдельная маска нужна лишь в одном случае: маркер сведён на непрозрачный
    // фон (так иногда делают ради лучшего трекинга) — тогда силуэт брать
    // неоткуда, и его загружают явно. Такая маска имеет приоритет.
    let maskTexture: any = null;

    if (experience.hasMask) {
      try {
        maskTexture = await Promise.race([
          new THREE.TextureLoader().loadAsync(arAssetUrl(slug, 'mask', version)),
          new Promise((resolve) => setTimeout(() => resolve(null), 8000)),
        ]);
        if (!maskTexture) {
          console.warn('[AR] mask load timed out, showing full video');
        }
      } catch (err) {
        console.warn('[AR] mask failed to load, showing full video', err);
        maskTexture = null;
      }
    } else if (markerImage && hasTransparency(markerImage)) {
      // маркер уже декодирован — берём текстуру из него, без второй загрузки
      maskTexture = new THREE.Texture(markerImage);
    }

    if (maskTexture) {
      // маска — это данные (не цвет), оставляем линейное пространство.
      // flipY как у видео-текстуры (у VideoTexture false, у TextureLoader
      // по умолчанию true) — иначе маска перевёрнута относительно видео.
      maskTexture.flipY = texture.flipY;
      maskTexture.generateMipmaps = false;
      maskTexture.minFilter = THREE.LinearFilter;
      maskTexture.anisotropy = 4;
      maskTexture.needsUpdate = true;
    }

    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
      transparent: !!maskTexture,
    });

    if (maskTexture) {
      // Патч шейдера: домножаем итоговую альфу видео на alpha-канал маски.
      // Маска = PNG-высечка: силуэт сувенира непрозрачный, фон прозрачный.
      material.onBeforeCompile = (shader: any) => {
        const src = shader.fragmentShader;
        const patched = src
          .replace(
            '#include <common>',
            '#include <common>\nuniform sampler2D uArMask;'
          )
          .replace(
            '#include <dithering_fragment>',
            '#include <dithering_fragment>\n  gl_FragColor.a *= texture2D( uArMask, vUv ).a;'
          );
        // если якоря не совпали (напр. сменилась версия three) — не вставляем
        // битый шейдер, деградируем до прямоугольного видео
        if (
          patched.includes('uniform sampler2D uArMask') &&
          patched.includes('texture2D( uArMask, vUv )')
        ) {
          shader.uniforms.uArMask = { value: maskTexture };
          shader.fragmentShader = patched;
        } else {
          console.warn('[AR] mask shader anchors not found, full video');
        }
      };
      material.needsUpdate = true;
    }

    const mesh = new THREE.Mesh(geometry, material);
    applyTransform(mesh);
    contentGroup.add(mesh);

    videoElRef.current = video;
    disposables.push(() => {
      texture.dispose();
      maskTexture?.dispose();
      geometry.dispose();
      material.dispose();
    });
    onAssetProgress(1);
    return null;
  }

  // ---- MODEL3D / ANIMATION: glTF-модель поверх маркера ----------------------

  let GLTFLoader: any;
  try {
    GLTFLoader = await loadGltfLoaderClass();
  } catch (err) {
    console.error('[AR] GLTFLoader load failed', err);
    throw new Error('gltf loader failed');
  }

  const modelUrl = arAssetUrl(slug, 'content', version);
  const gltf: any = await Promise.race([
    new Promise((resolve, reject) => {
      new GLTFLoader().load(
        modelUrl,
        resolve,
        (ev: ProgressEvent) => {
          if (ev.lengthComputable && ev.total > 0) {
            onAssetProgress((ev.loaded / ev.total) * 0.95);
          }
        },
        reject
      );
    }),
    new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error('model load timeout')), 60000)
    ),
  ]);

  const model = gltf?.scene || gltf?.scenes?.[0];
  if (!model) throw new Error('glb has no scene');

  let meshCount = 0;
  model.traverse((o: any) => {
    if (o.isMesh || o.isSkinnedMesh) meshCount++;
  });
  debugInfo.meshes =
    meshCount + ' | клипов: ' + ((gltf.animations || []).length || 0);
  if (meshCount === 0) {
    console.warn('[AR] в GLB нет ни одного меша — показывать нечего');
  }

  // Нормализация: вписываем модель в куб со стороной 1 (= ширина маркера),
  // центрируем по X/Z и ставим «на землю» (низ модели в 0 по Y). Благодаря
  // этому любая модель, независимо от единиц в GLB, появляется соразмерной
  // сувениру, а поле «Масштаб» в админке работает как множитель к этому.
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const rawMax = Math.max(size.x, size.y, size.z);

  // Габариты могут не посчитаться: пустой Box3 даёт -Infinity, а скелетная
  // модель без просчитанного bounding box — NaN. Оба варианта дальше
  // превращают scale в NaN/0, и модель исчезает бесследно — именно так это и
  // выглядит: маркер ловится, а показывать нечего. Подстраховываемся.
  const usable = Number.isFinite(rawMax) && rawMax > 1e-6;
  if (!usable) {
    console.warn(
      '[AR] не удалось измерить модель (габариты ' + rawMax + '), масштаб 1:1'
    );
  }
  const maxDim = usable ? rawMax : 1;
  const k = 1 / maxDim;
  const safeCenter = usable ? center : new THREE.Vector3(0, 0, 0);
  const safeMinY = usable ? box.min.y : 0;

  debugInfo.model =
    'габариты ' +
    size.x.toFixed(2) + '×' + size.y.toFixed(2) + '×' + size.z.toFixed(2) +
    ' | k=' + k.toFixed(4) +
    (usable ? '' : ' | ИЗМЕРИТЬ НЕ УДАЛОСЬ');

  // Подгонку вешаем на отдельную группу-обёртку, а не на сам gltf.scene:
  // анимационные клипы могут содержать ключи на трансформе корневого узла
  // (root motion), и тогда AnimationMixer каждый кадр перезаписывал бы наш
  // scale/position — модель прыгала бы в исходный размер.
  const fit = new THREE.Group();
  fit.scale.setScalar(k);
  fit.position.set(-safeCenter.x * k, -safeMinY * k, -safeCenter.z * k);
  fit.add(model);

  model.traverse((obj: any) => {
    if (obj.isMesh) {
      // маркер маленький, а модель может выходить за его габариты —
      // отсечение по фрустуму иногда прячет её целиком
      obj.frustumCulled = false;
    }
  });

  // Отдельная текстура-атлас: фотограмметрия часто отдаёт GLB с голой
  // геометрией и текстурой отдельным файлом. Если она загружена — натягиваем
  // её на все материалы модели. Ошибку/таймаут глушим: покажем модель как есть.
  let modelTexture: any = null;
  if (experience.hasTexture) {
    try {
      modelTexture = await Promise.race([
        new THREE.TextureLoader().loadAsync(
          arAssetUrl(slug, 'texture', version)
        ),
        new Promise((resolve) => setTimeout(() => resolve(null), 20000)),
      ]);
    } catch (err) {
      console.warn('[AR] model texture failed to load', err);
      modelTexture = null;
    }
  }

  if (modelTexture) {
    // В glTF ось V перевёрнута относительно дефолта three, поэтому GLTFLoader
    // грузит встроенные текстуры с flipY=false — внешнюю выставляем так же,
    // иначе развёртка ляжет вверх ногами.
    modelTexture.flipY = false;
    if ('colorSpace' in modelTexture)
      modelTexture.colorSpace = THREE.SRGBColorSpace;
    else modelTexture.encoding = THREE.sRGBEncoding;
    modelTexture.anisotropy = 8;
    modelTexture.needsUpdate = true;

    const touched = new Set<any>();
    model.traverse((obj: any) => {
      if (!obj.isMesh || !obj.material) return;
      const materials = Array.isArray(obj.material)
        ? obj.material
        : [obj.material];
      for (const material of materials) {
        if (!material || touched.has(material)) continue;
        touched.add(material);
        material.map = modelTexture;
        // базовый цвет в белый, иначе текстура затонируется цветом материала
        material.color?.setHex?.(0xffffff);
        material.needsUpdate = true;
      }
    });

    disposables.push(() => modelTexture.dispose());
  }

  // glTF — Y-up, а «наружу из маркера» у MindAR это +Z. Поворот на +90° по X
  // ставит модель вертикально на плоскость маркера («голограмма на открытке»).
  // Поля поворота из БД применяются поверх, поэтому rotationX = 0 — это уже
  // правильно стоящая модель, а не лежащая.
  const stand = new THREE.Group();
  stand.rotation.x = Math.PI / 2;
  stand.add(fit);

  const holder = new THREE.Group();
  holder.add(stand);
  applyTransform(holder);
  contentGroup.add(holder);

  let startAnimations: (() => void) | null = null;
  if (contentType === 'ANIMATION') {
    const clips: any[] = gltf.animations || [];
    if (clips.length === 0) {
      console.warn('[AR] GLB has no animation clips — showing static model');
    } else {
      // Несколько клипов нельзя запускать вслепую. Если они трогают одни и те
      // же узлы (а так бывает почти всегда: в GLB лежит несколько вариантов
      // одной анимации), AnimationMixer смешает их с полным весом, кости
      // получат противоречивые трансформы — и модель начнёт дёргаться. Со
      // стороны это неотличимо от плохого трекинга, хотя маркер держится
      // отлично.
      //
      // Пересечения нет только когда каждый клип анимирует свой объект — тогда
      // они дополняют друг друга и играть надо все.
      const nodesOf = (clip: any) =>
        new Set<string>(
          (clip.tracks || []).map((t: any) => String(t.name).split('.')[0])
        );

      // Явно выбранный админом клип имеет приоритет над любой эвристикой.
      const wanted = (experience.animationClip || '').trim();
      const picked = wanted
        ? clips.find((c: any) => c.name === wanted)
        : null;
      if (wanted && !picked) {
        console.warn(
          '[AR] клип «' + wanted + '» не найден в файле, играем по умолчанию'
        );
      }

      // Клип нулевой длительности — это не анимация, а одна статичная поза
      // (в экспортах Blender такой часто идёт первым как baselayer). В
      // автоматическом режиме брать его нельзя: модель замрёт в странном виде,
      // и со стороны это выглядит как сломанная анимация.
      const moving = clips.filter((c: any) => (c.duration || 0) > 0.01);
      const auto = moving.length ? moving : clips;

      let playable = picked ? [picked] : auto;
      if (!picked && auto.length > 1) {
        const seen = new Set<string>();
        let overlap = false;
        for (const clip of auto) {
          for (const node of nodesOf(clip)) {
            if (seen.has(node)) {
              overlap = true;
              break;
            }
            seen.add(node);
          }
          if (overlap) break;
        }
        if (overlap) {
          playable = [auto[0]];
          console.warn(
            '[AR] клипы пересекаются по узлам — играем только первый:',
            clips.map((c: any) => c.name).join(', ')
          );
        }
      }

      debugInfo.clips =
        (picked ? 'выбран «' + picked.name + '»' : playable.length + ' из ' + clips.length) +
        ' | всего: ' + clips.map((c: any) => c.name || '?').join(', ');

      const mixer = new THREE.AnimationMixer(model);
      const actions = playable.map((clip: any) => {
        const action = mixer.clipAction(clip);
        action.setLoop(
          experience.loop ? THREE.LoopRepeat : THREE.LoopOnce,
          Infinity
        );
        action.clampWhenFinished = !experience.loop;
        return action;
      });
      mixerRef.current = mixer;
      startAnimations = () => {
        actions.forEach((a: any) => {
          if (!a.isRunning()) a.reset().play();
        });
      };
      disposables.push(() => {
        try {
          mixer.stopAllAction();
          mixer.uncacheRoot(model);
        } catch {}
      });
    }
  }

  disposables.push(() => {
    model.traverse((obj: any) => {
      obj.geometry?.dispose?.();
      const mat = obj.material;
      if (mat) {
        (Array.isArray(mat) ? mat : [mat]).forEach((m: any) => {
          for (const mapKey of [
            'map',
            'normalMap',
            'roughnessMap',
            'metalnessMap',
            'emissiveMap',
            'aoMap',
            'alphaMap',
          ]) {
            m?.[mapKey]?.dispose?.();
          }
          m?.dispose?.();
        });
      }
    });
  });

  onAssetProgress(1);
  return startAnimations;
}

function classifyStartError(err: any): ARErrorKind {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'permission';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
    return 'noCamera';
  if (name === 'NotReadableError' || name === 'TrackStartError')
    return 'cameraBusy';
  if (name === 'OverconstrainedError') return 'noCamera';
  return 'unknown';
}

/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef } from 'react';
import {
  loadMindAr,
  loadGltfLoaderClass,
  AR_TRACKING_OPTIONS,
} from '@/lib/ar/config';
import { arAssetUrl } from '@/lib/ar/types';
import type { ARExperienceClient } from '@/lib/ar/types';
import type { ARErrorKind } from './ar-errors';

interface ARStageProps {
  experience: ARExperienceClient;
  soundOn: boolean;
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

function loadImageAspect(src: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () =>
      resolve(img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1);
    img.onerror = () => reject(new Error('marker image failed'));
    img.src = src;
  });
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
  onProgress,
  onScanning,
  onTargetFound,
  onTargetLost,
  onError,
}: ARStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const debugRef = useRef<HTMLPreElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
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
        'ardebug v2' + (bad ? '   !! NaN in video css !!' : ''),
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
      ].join('\n');
    };

    // resize() у MindAR пересоздаёт буфер рендера, а visualViewport 'scroll'
    // сыплется пачками — дёргаем только когда размер реально поменялся.
    let lastW = 0;
    let lastH = 0;
    const syncAndResize = (force = false) => {
      if (cancelled) return;
      syncContainerSize();
      const { w, h } = viewportSize();
      if (!force && w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      try {
        mindarThree?.resize();
      } catch {}
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
      }

      renderer = mindarThree.renderer;
      scene = mindarThree.scene;
      const camera = mindarThree.camera;

      // Свет для 3D-контента (для VIDEO не мешает — там MeshBasicMaterial)
      const hemi = new THREE.HemisphereLight(0xffffff, 0xbbc4d4, 1.15);
      const key = new THREE.DirectionalLight(0xffffff, 1.5);
      key.position.set(0.6, 1.2, 1.4);
      const fill = new THREE.DirectionalLight(0xffffff, 0.6);
      fill.position.set(-0.8, -0.4, 0.9);
      scene.add(hemi, key, fill);

      const anchor = mindarThree.addAnchor(0);

      let startAnimations: (() => void) | null = null;
      try {
        startAnimations = await buildContent({
          THREE,
          anchor,
          experience,
          videoElRef,
          mixerRef,
          disposables,
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

      anchor.onTargetFound = () => {
        isTrackingRef.current = true;
        cb.onTargetFound();
        if (experience.autoplay) {
          videoElRef.current?.play().catch(() => {});
          startAnimations?.();
        }
      };
      anchor.onTargetLost = () => {
        isTrackingRef.current = false;
        cb.onTargetLost();
        videoElRef.current?.pause();
      };

      try {
        await mindarThree.start();
      } catch (err: any) {
        console.error('[AR] mindar start failed', err);
        cb.onError(classifyStartError(err));
        return;
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
      renderer.setAnimationLoop(() => {
        const delta = clock.getDelta();
        if (mixerRef.current && isTrackingRef.current) {
          mixerRef.current.update(delta);
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

  // Звук управляется отдельно, без переинициализации сцены. Вызов из обработчика
  // клика по кнопке звука = пользовательский жест, поэтому play() проходит.
  useEffect(() => {
    const video = videoElRef.current;
    if (!video) return;
    video.muted = !soundOn;
    if (soundOn && isTrackingRef.current) {
      video.play().catch(() => {});
    }
  }, [soundOn]);

  return (
    <>
      {/* fixed + явные px-размеры из visualViewport (см. syncContainerSize) */}
      <div
        ref={containerRef}
        className="fixed left-0 top-0 overflow-hidden"
        style={{ width: '100vw', height: '100vh' }}
      />
      {/* диагностика раскладки: открыть /ar/{slug}?ardebug=1 */}
      <pre
        ref={debugRef}
        className="pointer-events-none fixed left-2 top-16 z-40 max-w-[92vw] whitespace-pre rounded bg-black/70 px-2 py-1 text-[10px] leading-tight text-lime-300"
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
  anchor,
  experience,
  videoElRef,
  mixerRef,
  disposables,
  onAssetProgress,
}: {
  THREE: any;
  anchor: any;
  experience: ARExperienceClient;
  videoElRef: React.MutableRefObject<HTMLVideoElement | null>;
  mixerRef: React.MutableRefObject<any>;
  disposables: Array<() => void>;
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
    video.muted = true; // старт всегда без звука (autoplay-политика iOS)
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

    const markerAspect = await loadImageAspect(
      arAssetUrl(slug, 'marker', version)
    ).catch(() => {
      const va = video.videoWidth / video.videoHeight;
      return Number.isFinite(va) && va > 0 ? va : 1;
    });

    // В системе координат MindAR ширина маркера = 1
    const width = 1;
    const height = 1 / markerAspect;

    const texture = new THREE.VideoTexture(video);
    if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
    else texture.encoding = THREE.sRGBEncoding;

    // Альфа-маска-силуэт для фигурных магнитов: видео видно только там, где
    // маска непрозрачная (её alpha-канал). Ошибку/таймаут загрузки глушим —
    // просто покажем прямоугольное видео.
    let maskTexture: any = null;
    if (experience.hasMask) {
      try {
        maskTexture = await Promise.race([
          new THREE.TextureLoader().loadAsync(arAssetUrl(slug, 'mask', version)),
          new Promise((resolve) => setTimeout(() => resolve(null), 8000)),
        ]);
        if (maskTexture) {
          // маска — это данные (не цвет), оставляем линейное пространство.
          // flipY как у видео-текстуры (у VideoTexture false, у TextureLoader
          // по умолчанию true) — иначе маска перевёрнута относительно видео.
          maskTexture.flipY = texture.flipY;
          maskTexture.generateMipmaps = false;
          maskTexture.minFilter = THREE.LinearFilter;
          maskTexture.anisotropy = 4;
          maskTexture.needsUpdate = true;
        } else {
          console.warn('[AR] mask load timed out, showing full video');
        }
      } catch (err) {
        console.warn('[AR] mask failed to load, showing full video', err);
        maskTexture = null;
      }
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
    anchor.group.add(mesh);

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

  // Нормализация: вписываем модель в куб со стороной 1 (= ширина маркера),
  // центрируем по X/Z и ставим «на землю» (низ модели в 0 по Y). Благодаря
  // этому любая модель, независимо от единиц в GLB, появляется соразмерной
  // сувениру, а поле «Масштаб» в админке работает как множитель к этому.
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const k = 1 / maxDim;
  model.scale.setScalar(k);
  model.position.set(-center.x * k, -box.min.y * k, -center.z * k);

  model.traverse((obj: any) => {
    if (obj.isMesh) {
      // маркер маленький, а модель может выходить за его габариты —
      // отсечение по фрустуму иногда прячет её целиком
      obj.frustumCulled = false;
    }
  });

  // glTF — Y-up, а «наружу из маркера» у MindAR это +Z. Поворот на +90° по X
  // ставит модель вертикально на плоскость маркера («голограмма на открытке»).
  // Поля поворота из БД применяются поверх, поэтому rotationX = 0 — это уже
  // правильно стоящая модель, а не лежащая.
  const stand = new THREE.Group();
  stand.rotation.x = Math.PI / 2;
  stand.add(model);

  const holder = new THREE.Group();
  holder.add(stand);
  applyTransform(holder);
  anchor.group.add(holder);

  let startAnimations: (() => void) | null = null;
  if (contentType === 'ANIMATION') {
    const clips: any[] = gltf.animations || [];
    if (clips.length === 0) {
      console.warn('[AR] GLB has no animation clips — showing static model');
    } else {
      const mixer = new THREE.AnimationMixer(model);
      const actions = clips.map((clip: any) => {
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

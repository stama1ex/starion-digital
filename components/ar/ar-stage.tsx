/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef } from 'react';
import { loadMindAr, AR_TRACKING_OPTIONS } from '@/lib/ar/config';
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

    async function init() {
      const cb = cbRef.current;
      cb.onProgress(0.05);

      if (!hasWebGL()) {
        cb.onError('webgl');
        return;
      }

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
      cb.onProgress(0.3);

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

      // мягкий свет, чтобы 3D-контент не был плоским (для VIDEO не мешает)
      const hemi = new THREE.HemisphereLight(0xffffff, 0xbbc4d4, 1.1);
      const dir = new THREE.DirectionalLight(0xffffff, 1.4);
      dir.position.set(0.5, 1, 1);
      scene.add(hemi, dir);

      const anchor = mindarThree.addAnchor(0);

      try {
        await buildContent({
          THREE,
          anchor,
          experience,
          videoElRef,
          disposables,
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
        const video = videoElRef.current;
        if (video && experience.autoplay) {
          video.play().catch(() => {});
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

  return <div ref={containerRef} className="absolute inset-0 overflow-hidden" />;
}

// ---- построение контента по типу ------------------------------------------

async function buildContent({
  THREE,
  anchor,
  experience,
  videoElRef,
  disposables,
}: {
  THREE: any;
  anchor: any;
  experience: ARExperienceClient;
  videoElRef: React.MutableRefObject<HTMLVideoElement | null>;
  disposables: Array<() => void>;
}) {
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

    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    applyTransform(mesh);
    anchor.group.add(mesh);

    videoElRef.current = video;
    disposables.push(() => {
      texture.dispose();
      geometry.dispose();
      material.dispose();
    });
    return;
  }

  // MODEL3D / ANIMATION — реализуются в следующем этапе (см. ADMIN_GUIDE).
  throw new Error(`content type ${contentType} not implemented yet`);
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

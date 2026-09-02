'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import {
  Camera,
  Loader2,
  RefreshCw,
  Volume2,
  VolumeX,
  X,
  ArrowRight,
  ScanLine,
} from 'lucide-react';
import { loadMindAr } from '@/lib/ar/config';
import { arAssetUrl } from '@/lib/ar/types';
import type { ARExperienceClient } from '@/lib/ar/types';
import { classifyMediaError, type ARErrorKind } from './ar-errors';

const ARStage = dynamic(() => import('./ar-stage'), { ssr: false });

type Phase = 'intro' | 'loading' | 'scanning' | 'tracking' | 'error';

interface ARViewerProps {
  experience: ARExperienceClient;
  catalogHref?: string;
}

export default function ARViewer({
  experience,
  catalogHref = '/',
}: ARViewerProps) {
  const t = useTranslations('ARViewer');

  const [phase, setPhase] = useState<Phase>('intro');
  const [errorKind, setErrorKind] = useState<ARErrorKind | null>(null);
  const [progress, setProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState<'camera' | 'assets'>(
    'camera'
  );
  const [stageMounted, setStageMounted] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const scanPingedRef = useRef(false);

  const showSoundToggle = experience.contentType === 'VIDEO' && experience.sound;

  // блокируем прокрутку сайта под полноэкранным вьюером
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // префетч тяжёлого MindAR-бандла, пока пользователь читает интро
  useEffect(() => {
    loadMindAr().catch(() => {});
  }, []);

  const fail = useCallback((kind: ARErrorKind) => {
    setErrorKind(kind);
    setPhase('error');
    setStageMounted(false);
  }, []);

  const pingScan = useCallback(() => {
    if (scanPingedRef.current) return;
    try {
      const key = `ar-scan:${experience.slug}`;
      if (sessionStorage.getItem(key)) {
        scanPingedRef.current = true;
        return;
      }
      sessionStorage.setItem(key, '1');
    } catch {
      /* приватный режим — просто пингуем один раз за монтирование */
    }
    scanPingedRef.current = true;
    fetch(`/api/ar/${encodeURIComponent(experience.slug)}/scan`, {
      method: 'POST',
      keepalive: true,
    }).catch(() => {});
  }, [experience.slug]);

  const handleStart = useCallback(async () => {
    setErrorKind(null);
    setProgress(0);
    setLoadingStage('camera');
    setPhase('loading');

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      fail('insecure');
      return;
    }
    const media =
      typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!media?.getUserMedia) {
      fail('unsupported');
      return;
    }

    // Прайминг доступа к камере в рамках пользовательского жеста — требование
    // iOS Safari. MindAR откроет камеру позже уже без жеста.
    try {
      const stream = await media.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      fail(classifyMediaError(err));
      return;
    }

    pingScan();
    setLoadingStage('assets');
    setStageMounted(true);
  }, [fail, pingScan]);

  const handleRetry = useCallback(() => {
    setErrorKind(null);
    setProgress(0);
    setStageMounted(false);
    setPhase('intro');
  }, []);

  const handleClose = useCallback(() => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = catalogHref;
  }, [catalogHref]);

  const posterUrl = experience.hasPoster
    ? arAssetUrl(experience.slug, 'poster', experience.version)
    : null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-black text-white select-none">
      {/* Слой AR (камера + canvas). Держим смонтированным со стадии загрузки. */}
      {stageMounted && (
        <ARStage
          experience={experience}
          soundOn={soundOn}
          onProgress={setProgress}
          onScanning={() =>
            setPhase((p) => (p === 'loading' ? 'scanning' : p))
          }
          onTargetFound={() => setPhase('tracking')}
          onTargetLost={() =>
            setPhase((p) => (p === 'tracking' ? 'scanning' : p))
          }
          onError={fail}
        />
      )}

      {/* Кнопка закрытия — поверх всего */}
      <button
        type="button"
        onClick={handleClose}
        aria-label={t('close')}
        className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-3 z-30 grid h-10 w-10 place-items-center rounded-full bg-black/45 backdrop-blur transition hover:bg-black/65"
      >
        <X className="h-5 w-5" />
      </button>

      {/* ---------- ИНТРО ---------- */}
      {phase === 'intro' && (
        <div className="relative z-20 flex flex-1 flex-col">
          {posterUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={posterUrl}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-lg"
            />
          )}
          <div className="relative flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
            {posterUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={posterUrl}
                alt={experience.title}
                className="max-h-[38vh] w-auto max-w-[80vw] rounded-2xl object-contain shadow-2xl ring-1 ring-white/10"
              />
            )}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {experience.title}
              </h1>
              <p className="mx-auto max-w-sm text-sm text-white/70">
                {t('intro.subtitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleStart}
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-black transition active:scale-[0.98]"
            >
              <Camera className="h-5 w-5" />
              {t('intro.start')}
            </button>
            <p className="text-xs text-white/45">{t('intro.hint')}</p>
          </div>
          <ViewerFooter t={t} catalogHref={catalogHref} />
        </div>
      )}

      {/* ---------- ЗАГРУЗКА ---------- */}
      {phase === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-black/70 px-8 text-center backdrop-blur-sm">
          <Loader2 className="h-9 w-9 animate-spin text-white/80" />
          <div className="space-y-3">
            <p className="text-sm text-white/80">
              {loadingStage === 'camera'
                ? t('loading.camera')
                : t('loading.assets', { progress: Math.round(progress * 100) })}
            </p>
            <div className="mx-auto h-1.5 w-56 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-300"
                style={{
                  width: `${Math.max(
                    8,
                    Math.round(
                      (loadingStage === 'camera' ? 0.1 : progress) * 100
                    )
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ---------- ПОИСК МАРКЕРА ---------- */}
      {phase === 'scanning' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col">
          <div className="flex justify-center px-6 pt-[calc(env(safe-area-inset-top)+4rem)]">
            <p className="rounded-full bg-black/45 px-4 py-2 text-sm text-white/90 backdrop-blur">
              {t('scanning.hint')}
            </p>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="relative h-56 w-56 max-w-[62vw]">
              <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-2 border-t-2 border-white/80" />
              <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-2 border-t-2 border-white/80" />
              <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-2 border-l-2 border-white/80" />
              <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-2 border-r-2 border-white/80" />
              <ScanLine className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-pulse text-white/50" />
            </div>
          </div>
          <BottomBar
            t={t}
            catalogHref={catalogHref}
            showSoundToggle={showSoundToggle}
            soundOn={soundOn}
            onToggleSound={() => setSoundOn((s) => !s)}
          />
        </div>
      )}

      {/* ---------- КОНТЕНT НАЙДЕН ---------- */}
      {phase === 'tracking' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end">
          <BottomBar
            t={t}
            catalogHref={catalogHref}
            showSoundToggle={showSoundToggle}
            soundOn={soundOn}
            onToggleSound={() => setSoundOn((s) => !s)}
          />
        </div>
      )}

      {/* ---------- ОШИБКА ---------- */}
      {phase === 'error' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-black/80 px-8 text-center backdrop-blur">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-white/10">
            <Camera className="h-7 w-7 text-white/70" />
          </div>
          <div className="space-y-1.5">
            <p className="text-lg font-semibold">{t('error.title')}</p>
            <p className="mx-auto max-w-sm text-sm text-white/70">
              {t(`error.${errorKind ?? 'unknown'}`)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" />
            {t('error.retry')}
          </button>
          <a
            href={catalogHref}
            className="text-xs text-white/50 underline underline-offset-4"
          >
            {t('cta.catalog')}
          </a>
        </div>
      )}
    </div>
  );
}

function BottomBar({
  t,
  catalogHref,
  showSoundToggle,
  soundOn,
  onToggleSound,
}: {
  t: ReturnType<typeof useTranslations>;
  catalogHref: string;
  showSoundToggle: boolean;
  soundOn: boolean;
  onToggleSound: () => void;
}) {
  return (
    <div className="pointer-events-auto flex items-center justify-between gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
      <a
        href={catalogHref}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
      >
        {t('cta.catalog')}
        <ArrowRight className="h-4 w-4" />
      </a>
      {showSoundToggle && (
        <button
          type="button"
          onClick={onToggleSound}
          aria-label={soundOn ? t('sound.off') : t('sound.on')}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/12 backdrop-blur transition hover:bg-white/20"
        >
          {soundOn ? (
            <Volume2 className="h-5 w-5" />
          ) : (
            <VolumeX className="h-5 w-5" />
          )}
        </button>
      )}
    </div>
  );
}

function ViewerFooter({
  t,
  catalogHref,
}: {
  t: ReturnType<typeof useTranslations>;
  catalogHref: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] text-xs text-white/45">
      <a href={catalogHref} className="underline underline-offset-4">
        {t('cta.catalog')}
      </a>
      <span>{t('poweredBy')}</span>
    </div>
  );
}

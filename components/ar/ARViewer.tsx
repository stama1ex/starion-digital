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
  Languages,
} from 'lucide-react';
import { loadMindAr } from '@/lib/ar/config';
import { arAssetUrl } from '@/lib/ar/types';
import type { ARExperienceClient } from '@/lib/ar/types';
import { classifyMediaError, type ARErrorKind } from './ar-errors';
import { ARSocialLinks } from './ar-socials';
import { socialHref } from '@/lib/ar/socials';

const ARStage = dynamic(() => import('./ar-stage'), { ssr: false });

type Phase = 'intro' | 'loading' | 'scanning' | 'tracking' | 'error';

interface ARViewerProps {
  experience: ARExperienceClient;
  catalogHref?: string;
}

export default function ARViewer({
  experience,
  // абсолютный адрес: вьюер может отдаваться и с отдельного AR-домена, где
  // остального сайта просто нет
  catalogHref = process.env.NEXT_PUBLIC_SITE_URL || '/',
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
  const [audioTrackIndex, setAudioTrackIndex] = useState(0);
  const [langOpen, setLangOpen] = useState(false);
  const scanPingedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const audioTracks = experience.audioTracks;
  const hasAudioTracks = audioTracks.length > 0;

  // Белая метка: ни подписи, ни ссылки на наш каталог. Вместо каталога — сайт
  // клиента, если он указан в соцсетях; не указан — кнопки просто нет.
  const clientSite = experience.socials?.website
    ? socialHref('website', experience.socials.website)
    : null;
  const outboundHref = experience.whiteLabel ? clientSite : catalogHref;
  const outboundLabel = experience.whiteLabel
    ? t('cta.website')
    : t('cta.catalog');
  // Кнопка звука нужна и когда звук берётся из отдельной озвучки, а не из
  // видео, — но тумблер «Звук» в админке решает в обоих случаях.
  const showSoundToggle =
    experience.sound &&
    (hasAudioTracks || experience.contentType === 'VIDEO');

  // блокируем прокрутку сайта под полноэкранным вьюером
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Держим вьюер ровно по видимой области. На мобильных vh/dvh расходятся с
  // тем, что реально видно (адресная строка), из-за чего оверлеи уезжают, а
  // слой камеры внутри ARStage считает свой размер отдельно — синхронизируем
  // оба от одного источника (visualViewport).
  useEffect(() => {
    const apply = () => {
      const el = rootRef.current;
      if (!el) return;
      const vv = window.visualViewport;
      const w = Math.round(vv?.width ?? window.innerWidth);
      const h = Math.round(vv?.height ?? window.innerHeight);
      if (w > 1) el.style.width = w + 'px';
      if (h > 1) el.style.height = h + 'px';
    };
    apply();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', apply);
    vv?.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      vv?.removeEventListener('resize', apply);
      vv?.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
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
    // Размер строго по видимой области: 100dvh на мобильных совпадает с тем,
    // что видно, поэтому нижняя панель не уезжает под адресную строку.
    // h-screen (100vh) — запасной вариант: если браузер не знает dvh,
    // инлайновое значение отбрасывается и остаётся класс.
    <div
      ref={rootRef}
      className="fixed left-0 top-0 z-[100] flex h-screen w-screen flex-col overflow-hidden bg-black text-white select-none"
      style={{ width: '100vw', height: '100dvh' }}
    >
      {/* Слой AR (камера + canvas). Держим смонтированным со стадии загрузки. */}
      {stageMounted && (
        <ARStage
          experience={experience}
          soundOn={soundOn}
          audioTrackIndex={audioTrackIndex}
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
        className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-3 z-30 grid h-10 w-10 place-items-center rounded-full bg-black/60 transition hover:bg-black/75"
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
          <ARSocialLinks
            socials={experience.socials}
            className="flex flex-wrap justify-center gap-2 px-6 pb-2"
          />
          <ViewerFooter
            poweredBy={experience.whiteLabel ? null : t('poweredBy')}
            outboundHref={outboundHref}
            outboundLabel={outboundLabel}
          />
        </div>
      )}

      {/* ---------- ЗАГРУЗКА ---------- */}
      {phase === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-black/85 px-8 text-center">
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
            <p className="rounded-full bg-black/60 px-4 py-2 text-sm text-white/90">
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
            outboundHref={outboundHref}
            outboundLabel={outboundLabel}
            showSoundToggle={showSoundToggle}
            soundOn={soundOn}
            onToggleSound={() => setSoundOn((s) => !s)}
            socials={experience.socials}
            audioTracks={audioTracks}
            audioTrackIndex={audioTrackIndex}
            onPickTrack={setAudioTrackIndex}
            langOpen={langOpen}
            onToggleLang={() => setLangOpen((v) => !v)}
          />
        </div>
      )}

      {/* ---------- КОНТЕНТ НАЙДЕН ---------- */}
      {phase === 'tracking' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end">
          <BottomBar
            t={t}
            outboundHref={outboundHref}
            outboundLabel={outboundLabel}
            showSoundToggle={showSoundToggle}
            soundOn={soundOn}
            onToggleSound={() => setSoundOn((s) => !s)}
            socials={experience.socials}
            audioTracks={audioTracks}
            audioTrackIndex={audioTrackIndex}
            onPickTrack={setAudioTrackIndex}
            langOpen={langOpen}
            onToggleLang={() => setLangOpen((v) => !v)}
          />
        </div>
      )}

      {/* ---------- ОШИБКА ---------- */}
      {phase === 'error' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-black/90 px-8 text-center">
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
  outboundHref,
  outboundLabel,
  showSoundToggle,
  soundOn,
  onToggleSound,
  socials,
  audioTracks,
  audioTrackIndex,
  onPickTrack,
  langOpen,
  onToggleLang,
}: {
  t: ReturnType<typeof useTranslations>;
  outboundHref: string | null;
  outboundLabel: string;
  showSoundToggle: boolean;
  soundOn: boolean;
  onToggleSound: () => void;
  socials: ARExperienceClient['socials'];
  audioTracks: ARExperienceClient['audioTracks'];
  audioTrackIndex: number;
  onPickTrack: (index: number) => void;
  langOpen: boolean;
  onToggleLang: () => void;
}) {
  // Переключатель нужен только когда языков реально несколько
  const showLangPicker = audioTracks.length > 1;

  return (
    <div className="pointer-events-auto flex flex-col gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
      {/* Соцсети — только заполненные при создании оживления */}
      <ARSocialLinks
        socials={socials}
        className="flex flex-wrap justify-center gap-2"
      />

      {showLangPicker && langOpen && (
        <div className="mx-auto flex max-w-full flex-wrap justify-center gap-2 rounded-2xl bg-black/70 p-2">
          {audioTracks.map((track, index) => (
            <button
              key={track.lang}
              type="button"
              onClick={() => onPickTrack(index)}
              className={
                'rounded-full px-3 py-1.5 text-sm transition ' +
                (index === audioTrackIndex
                  ? 'bg-white font-semibold text-black'
                  : 'bg-white/15 text-white hover:bg-white/25')
              }
            >
              {track.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        {outboundHref ? (
          <a
            href={outboundHref}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/30"
          >
            {outboundLabel}
            <ArrowRight className="h-4 w-4" />
          </a>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-2">
          {showLangPicker && (
            <button
              type="button"
              onClick={onToggleLang}
              aria-label={t('audio.language')}
              aria-expanded={langOpen}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/30"
            >
              <Languages className="h-5 w-5" />
              {audioTracks[audioTrackIndex]?.label}
            </button>
          )}
          {showSoundToggle && (
            <button
              type="button"
              onClick={onToggleSound}
              aria-label={soundOn ? t('sound.off') : t('sound.on')}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/20 transition hover:bg-white/30"
            >
              {soundOn ? (
                <Volume2 className="h-5 w-5" />
              ) : (
                <VolumeX className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ViewerFooter({
  poweredBy,
  outboundHref,
  outboundLabel,
}: {
  poweredBy: string | null;
  outboundHref: string | null;
  outboundLabel: string;
}) {
  // При белой метке и без сайта клиента подвал пуст — не рисуем его совсем,
  // чтобы не осталась полоса отступов
  if (!poweredBy && !outboundHref) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] text-xs text-white/45">
      {outboundHref ? (
        <a href={outboundHref} className="underline underline-offset-4">
          {outboundLabel}
        </a>
      ) : (
        <span />
      )}
      {poweredBy && <span>{poweredBy}</span>}
    </div>
  );
}

/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Edit2,
  Trash2,
  QrCode,
  ExternalLink,
  Copy,
  Loader2,
  Upload,
  Check,
  X,
  Eye,
  EyeOff,
  ScanEye,
} from 'lucide-react';
import type { ARContentType } from '@prisma/client';
import {
  useARExperiences,
  useProducts,
  AdminAPI,
  handleApiError,
  PRODUCT_TYPE_LABELS,
} from '@/lib/admin';
import { useConfirm } from '@/app/providers/confirm-provider';
import {
  AR_CONTENT_TYPES,
  AR_CONTENT_TYPE_LABELS,
  AR_CONTENT_TYPE_HINTS,
  AR_EXPERIENCE_DEFAULTS,
  AR_UPLOAD_LIMITS,
  slugifyAr,
  type ARAssetKind,
} from '@/lib/ar/constants';
import { ArQrDialog } from '@/components/ar/ar-qr-dialog';

interface FormState {
  title: string;
  slug: string;
  slugTouched: boolean;
  contentType: ARContentType;
  productId: string;
  markerUrl: string;
  mindFileUrl: string;
  contentUrl: string;
  maskUrl: string;
  textureUrl: string;
  posterUrl: string;
  scale: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  autoplay: boolean;
  loop: boolean;
  sound: boolean;
  isActive: boolean;
}

const emptyForm = (): FormState => ({
  title: '',
  slug: '',
  slugTouched: false,
  contentType: 'VIDEO',
  productId: '',
  markerUrl: '',
  mindFileUrl: '',
  contentUrl: '',
  maskUrl: '',
  textureUrl: '',
  posterUrl: '',
  ...AR_EXPERIENCE_DEFAULTS,
});

// Быстрая проверка, что у PNG-маски вообще есть прозрачные пиксели по краям.
// Иначе (непрозрачный фон) маска не обрежет видео, а ошибки никакой не будет —
// предупредим админа сразу при загрузке.
async function maskLooksLikeCutout(file: File): Promise<boolean> {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const w = 64;
    const h = Math.max(1, Math.round((img.height / img.width) * 64));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    URL.revokeObjectURL(url);
    if (!ctx) return true;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    // доля полностью прозрачных пикселей
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 8) transparent++;
    return transparent / (w * h) > 0.05;
  } catch {
    return true; // не смогли проверить — не мешаем
  }
}

// Прямая загрузка ассета в Dropbox через одноразовую ссылку (минуя лимит
// тела запроса Vercel).
async function uploadArAsset(
  kind: ARAssetKind,
  file: File,
  title: string
): Promise<string> {
  const linkRes = await fetch('/api/admin/ar/upload-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // title -> папка опыта в Dropbox: /ar/<Название>/...
    body: JSON.stringify({ filename: file.name, kind, size: file.size, title }),
  });
  if (!linkRes.ok) {
    const data = await linkRes.json().catch(() => ({}));
    throw new Error(data.error || 'Не удалось получить ссылку для загрузки');
  }
  const { uploadUrl, path } = await linkRes.json();

  const up = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  });
  if (!up.ok) {
    throw new Error(`Dropbox отклонил загрузку (${up.status})`);
  }
  return path as string;
}

export default function ARManagement() {
  const { experiences, loading, loaded, error, mutate } = useARExperiences();
  const { products } = useProducts();
  const confirm = useConfirm();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [qrFor, setQrFor] = useState<{ slug: string; title: string } | null>(
    null
  );

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  const openNew = () => {
    setForm(emptyForm());
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (exp: any) => {
    setForm({
      title: exp.title,
      slug: exp.slug,
      slugTouched: true,
      contentType: exp.contentType,
      productId: exp.productId ? String(exp.productId) : '',
      markerUrl: exp.markerUrl,
      mindFileUrl: exp.mindFileUrl,
      contentUrl: exp.contentUrl,
      maskUrl: exp.maskUrl || '',
      textureUrl: exp.textureUrl || '',
      posterUrl: exp.posterUrl || '',
      scale: exp.scale,
      rotationX: exp.rotationX,
      rotationY: exp.rotationY,
      rotationZ: exp.rotationZ,
      offsetX: exp.offsetX,
      offsetY: exp.offsetY,
      offsetZ: exp.offsetZ,
      autoplay: exp.autoplay,
      loop: exp.loop,
      sound: exp.sound,
      isActive: exp.isActive,
    });
    setEditingId(exp.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Укажите название');
      return;
    }
    const slug = slugifyAr(form.slug || form.title);
    if (!slug) {
      toast.error('Не удалось построить slug — укажите его вручную латиницей');
      return;
    }
    if (!form.markerUrl || !form.mindFileUrl || !form.contentUrl) {
      toast.error('Загрузите маркер, .mind файл и контент');
      return;
    }

    const payload = {
      ...form,
      slug,
      productId: form.productId || null,
    };

    setSaving(true);
    try {
      if (editingId) {
        await AdminAPI.updateARExperience(editingId, payload);
      } else {
        await AdminAPI.createARExperience(payload);
      }
      setDialogOpen(false);
      await mutate();
      toast.success('AR-опыт сохранён');
    } catch (error) {
      toast.error('Ошибка сохранения: ' + (await handleApiError(error)));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (exp: any) => {
    const ok = await confirm({
      description: `Удалить AR-опыт «${exp.title}»? QR-коды на печати перестанут работать.`,
      confirmText: 'Удалить',
      variant: 'destructive',
    });
    if (!ok) return;

    mutate(
      experiences.filter((e: any) => e.id !== exp.id),
      { revalidate: false }
    );
    try {
      await AdminAPI.deleteARExperience(exp.id);
      toast.success('Удалено');
    } catch (error) {
      await mutate();
      toast.error('Ошибка удаления: ' + (await handleApiError(error)));
    }
  };

  const toggleActive = async (exp: any) => {
    const isActive = !exp.isActive;
    mutate(
      experiences.map((e: any) => (e.id === exp.id ? { ...e, isActive } : e)),
      { revalidate: false }
    );
    try {
      await AdminAPI.updateARExperience(exp.id, { isActive });
    } catch (error) {
      await mutate();
      toast.error('Ошибка: ' + (await handleApiError(error)));
    }
  };

  const copyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/ar/${slug}`
      );
      toast.success('Ссылка скопирована');
    } catch {
      toast.error('Не удалось скопировать');
    }
  };

  // Важно: НЕ делать ранний `return` по loading/error — иначе на каждом
  // ре-валидейте SWR (а при падающем эндпоинте это каждые несколько секунд)
  // размонтируется всё поддерево, включая открытый <Dialog>, и модалка мигает.
  // Состояние списка показываем только в области списка, диалоги — всегда в DOM.
  // Ключуемся от «был ли успешный ответ» (loaded), а не от experiences.length:
  // иначе после применения миграции разовая фоновая ошибка подменяет «Пока нет
  // опытов» на экран «примените миграцию». error в SWR залипает до первого
  // успеха, поэтому показываем его стабильно, без мигания «Загрузка…» ↔ ошибка.
  const showError = !!error && !loaded;
  const showSkeleton = loading && !error && !loaded;

  // Какие поля вообще имеют смысл для выбранного типа контента.
  // Звук — только у видео; автозапуск/зацикливание — там, где есть что играть;
  // маска-силуэт — только для видео на плоскости; внешняя текстура — только
  // для GLB-моделей.
  const isVideo = form.contentType === 'VIDEO';
  const isModel = !isVideo;
  const hasPlayback = isVideo || form.contentType === 'ANIMATION';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">AR — Оживление сувениров</h2>
          <p className="text-sm text-muted-foreground">
            QR на сувенире → страница /ar/&#123;slug&#125; → камера распознаёт
            сам сувенир и накладывает видео / 3D / анимацию.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2" disabled={showError}>
          <Plus size={16} /> Новый AR-опыт
        </Button>
      </div>

      {showSkeleton ? (
        <p className="py-10 text-center text-muted-foreground">Загрузка…</p>
      ) : showError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">
            Не удалось загрузить AR-опыты
          </p>
          <p className="mt-1 text-muted-foreground">
            Скорее всего, не применена миграция БД. Выполните{' '}
            <code className="rounded bg-muted px-1">
              npx prisma migrate deploy
            </code>{' '}
            и обновите страницу.
          </p>
        </div>
      ) : experiences.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">
          Пока нет ни одного AR-опыта
        </p>
      ) : (
        <div className="grid gap-2">
          {experiences.map((exp: any) => (
            <Card key={exp.id} className={exp.isActive ? 'p-0' : 'p-0 opacity-60'}>
              <CardContent className="flex flex-col gap-3 px-3 py-2 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-semibold">{exp.title}</span>
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
                    /ar/{exp.slug}
                  </span>
                  <span className="rounded border px-1.5 py-0.5 text-xs">
                    {AR_CONTENT_TYPE_LABELS[exp.contentType as ARContentType]}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ScanEye size={13} /> {exp.scanCount}
                  </span>
                  {exp.product && (
                    <span className="text-xs text-muted-foreground">
                      {PRODUCT_TYPE_LABELS[exp.product.type] || exp.product.type}{' '}
                      {exp.product.number}
                    </span>
                  )}
                  {!exp.isActive && (
                    <span className="rounded border border-amber-500/40 px-1.5 py-0.5 text-xs text-amber-600 dark:text-amber-500">
                      Выключен
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => setQrFor({ slug: exp.slug, title: exp.title })}
                  >
                    <QrCode size={14} />
                    <span className="hidden sm:inline">QR</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    asChild
                  >
                    <a
                      href={`/ar/${exp.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={14} />
                      <span className="hidden sm:inline">Просмотр</span>
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => copyLink(exp.slug)}
                  >
                    <Copy size={14} />
                    <span className="hidden sm:inline">Ссылка</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => toggleActive(exp)}
                  >
                    {exp.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => openEdit(exp)}
                  >
                    <Edit2 size={14} />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => handleDelete(exp)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Редактировать AR-опыт' : 'Новый AR-опыт'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Название</label>
              <Input
                value={form.title}
                onChange={(e) => {
                  const title = e.target.value;
                  patch({
                    title,
                    slug: form.slugTouched ? form.slug : slugifyAr(title),
                  });
                }}
                placeholder="Магнит «Кишинёв — Арка Победы»"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Slug (в ссылке и QR)
              </label>
              <Input
                value={form.slug}
                onChange={(e) =>
                  patch({ slug: slugifyAr(e.target.value), slugTouched: true })
                }
                placeholder="chisinau-arch"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Ссылка: {typeof window !== 'undefined' ? window.location.origin : ''}
                /ar/{form.slug || '…'}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Тип контента</label>
              <Select
                value={form.contentType}
                onValueChange={(v) =>
                  patch({
                    contentType: v as ARContentType,
                    // маска — только для VIDEO, текстура — только для GLB:
                    // не тащим за собой ассет, неприменимый к новому типу
                    maskUrl: v === 'VIDEO' ? form.maskUrl : '',
                    textureUrl: v === 'VIDEO' ? '' : form.textureUrl,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AR_CONTENT_TYPES.map((ct) => (
                    <SelectItem key={ct} value={ct}>
                      {AR_CONTENT_TYPE_LABELS[ct]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {AR_CONTENT_TYPE_HINTS[form.contentType]}
              </p>
              {form.contentType !== 'VIDEO' && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Модель автоматически вписывается в размер маркера и ставится
                  вертикально на него, поэтому «Поворот X = 0» — это уже
                  стоящая модель. Развернуть её лицом — «Поворот Z»
                  (π ≈ 3.14 — разворот на 180°). Draco/KTX2-сжатие пока не
                  поддерживается — экспортируйте обычный .glb.
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">
                Товар каталога (необязательно)
              </label>
              <Select
                value={form.productId || 'NONE'}
                onValueChange={(v) =>
                  patch({ productId: v === 'NONE' ? '' : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Не привязан" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Не привязан</SelectItem>
                  {products.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {(PRODUCT_TYPE_LABELS[p.type] || p.type) + ' ' + p.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <AssetField
              kind="marker"
              label="Изображение-маркер (сам сувенир)"
              hint="Контрастная детальная картинка. Из неё компилируется .mind."
              value={form.markerUrl}
              onChange={(path) => patch({ markerUrl: path })}
              title={form.title}
              preview
            />
            <AssetField
              kind="mind"
              label=".mind файл (скомпилированный маркер)"
              hint="scripts/compile-marker.ts или веб-компилятор MindAR."
              value={form.mindFileUrl}
              onChange={(path) => patch({ mindFileUrl: path })}
              title={form.title}
            />
            <AssetField
              kind="content"
              label={
                isVideo ? 'Видео (mp4/webm)' : 'Модель GLB'
              }
              hint={
                isVideo
                  ? 'Короткий клип. Для звука включите тумблер ниже.'
                  : form.contentType === 'ANIMATION'
                    ? 'glTF Binary (.glb) со встроенными анимационными клипами — они проигрываются, пока маркер в кадре.'
                    : 'glTF Binary (.glb), статичная модель.'
              }
              value={form.contentUrl}
              onChange={(path) => patch({ contentUrl: path })}
              title={form.title}
            />
            {isVideo && (
              <AssetField
                kind="mask"
                label="Маска-силуэт — необязательно (для фигурных магнитов)"
                hint="PNG-высечка в той же кадрировке, что и маркер: силуэт сувенира — непрозрачный, фон — полностью прозрачный. Видео покажется только внутри силуэта. Делайте силуэт на 1–2% уже реального края."
                value={form.maskUrl}
                onChange={(path) => patch({ maskUrl: path })}
                preview
                title={form.title}
              />
            )}
            {isModel && (
              <AssetField
                kind="texture"
                label="Текстура модели — необязательно"
                hint="Если .glb без встроенных текстур (частый случай у фотограмметрии) — загрузите сюда атлас (jpg/png). Он натянется на все материалы модели по её UV-развёртке."
                value={form.textureUrl}
                onChange={(path) => patch({ textureUrl: path })}
                preview
                title={form.title}
              />
            )}
            <AssetField
              kind="poster"
              label="Постер (экран загрузки, превью при шеринге) — необязательно"
              hint="Если не задан — используется маркер."
              value={form.posterUrl}
              onChange={(path) => patch({ posterUrl: path })}
              title={form.title}
              preview
            />

            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Позиционирование контента
              </summary>
              <div className="mt-3 space-y-3">
                <NumberRow
                  label="Масштаб"
                  values={[['scale', form.scale]]}
                  onChange={patch}
                  step={0.05}
                />
                <NumberRow
                  label="Поворот X / Y / Z (рад)"
                  values={[
                    ['rotationX', form.rotationX],
                    ['rotationY', form.rotationY],
                    ['rotationZ', form.rotationZ],
                  ]}
                  onChange={patch}
                  step={0.05}
                />
                <NumberRow
                  label="Смещение X / Y / Z"
                  values={[
                    ['offsetX', form.offsetX],
                    ['offsetY', form.offsetY],
                    ['offsetZ', form.offsetZ],
                  ]}
                  onChange={patch}
                  step={0.05}
                />
              </div>
            </details>

            <div className="grid grid-cols-2 gap-2">
              {hasPlayback && (
                <Toggle
                  label={isVideo ? 'Автозапуск видео' : 'Автозапуск анимации'}
                  checked={form.autoplay}
                  onChange={(v) => patch({ autoplay: v })}
                />
              )}
              {hasPlayback && (
                <Toggle
                  label="Зациклить"
                  checked={form.loop}
                  onChange={(v) => patch({ loop: v })}
                />
              )}
              {isVideo && (
                <Toggle
                  label="Звук"
                  checked={form.sound}
                  onChange={(v) => patch({ sound: v })}
                />
              )}
              <Toggle
                label="Активен"
                checked={form.isActive}
                onChange={(v) => patch({ isActive: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {qrFor && (
        <ArQrDialog
          open={!!qrFor}
          onOpenChange={(o) => !o && setQrFor(null)}
          slug={qrFor.slug}
          title={qrFor.title}
        />
      )}
    </div>
  );
}

// ---- подкомпоненты формы --------------------------------------------------

function AssetField({
  kind,
  label,
  hint,
  value,
  onChange,
  preview = false,
  title,
}: {
  kind: ARAssetKind;
  label: string;
  hint?: string;
  value: string;
  onChange: (path: string) => void;
  preview?: boolean;
  title: string;
}) {
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const limit = AR_UPLOAD_LIMITS[kind];

  useEffect(() => {
    if (!preview || !value) {
      setPreviewUrl('');
      return;
    }
    let active = true;
    fetch(`/api/admin/ar/preview?path=${encodeURIComponent(value)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => active && d?.url && setPreviewUrl(d.url))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [preview, value]);

  const handleFile = async (file?: File) => {
    if (!file) return;
    // папка в Dropbox называется по «Названию», поэтому без него загрузка
    // ушла бы в /ar/_без-названия и потерялась среди остальных
    if (!title.trim()) {
      toast.error('Сначала укажите название — по нему создаётся папка в Dropbox');
      return;
    }
    if (file.size > limit.maxBytes) {
      toast.error(
        `Файл больше ${Math.round(limit.maxBytes / (1024 * 1024))} МБ`
      );
      return;
    }
    if (kind === 'mask' && !(await maskLooksLikeCutout(file))) {
      toast.warning(
        'В маске нет прозрачного фона — видео не обрежется по форме. Нужен PNG с прозрачностью вокруг силуэта.'
      );
    }
    setBusy(true);
    try {
      const path = await uploadArAsset(kind, file, title);
      onChange(path);
      toast.success('Загружено');
    } catch (error: any) {
      toast.error(error?.message || 'Ошибка загрузки');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1 rounded-md border p-2">
        {value ? (
          <div className="flex items-center gap-3">
            {preview && previewUrl ? (
              <img
                src={previewUrl}
                alt=""
                className="h-14 w-14 rounded object-cover"
              />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded bg-muted">
                <Check className="h-5 w-5 text-green-600" />
              </div>
            )}
            <span className="flex-1 truncate font-mono text-xs text-muted-foreground">
              {value.split('/').pop()}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange('')}
            >
              <X size={14} />
            </Button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {busy ? 'Загрузка…' : 'Выбрать файл'}
            <input
              type="file"
              accept={limit.accept}
              className="hidden"
              disabled={busy}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function NumberRow({
  label,
  values,
  onChange,
  step = 0.1,
}: {
  label: string;
  values: Array<[keyof FormState, number]>;
  onChange: (p: Partial<FormState>) => void;
  step?: number;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        {values.map(([key, val]) => (
          <Input
            key={String(key)}
            type="number"
            step={step}
            value={val}
            onChange={(e) =>
              onChange({ [key]: Number(e.target.value) } as Partial<FormState>)
            }
          />
        ))}
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="h-4 w-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, ImageOff, Loader2 } from 'lucide-react';
import { arUrl } from './ar-qr-dialog';

interface ArTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  title: string;
  markerPath: string | null;
}

// Проверка оживления без печати: маркер показываем крупно прямо на мониторе,
// а QR под ним открывает страницу на телефоне. Дальше телефон наводят на
// монитор. Это удобно для быстрой проверки, но экран — плохой маркер (блики и
// муар), поэтому итоговое качество всё равно проверяют по напечатанному
// образцу; об этом прямо сказано в окне.
export function ArTestDialog({
  open,
  onOpenChange,
  slug,
  title,
  markerPath,
}: ArTestDialogProps) {
  const [markerUrl, setMarkerUrl] = useState('');
  const [markerFailed, setMarkerFailed] = useState(false);
  const [qr, setQr] = useState('');
  const url = arUrl(slug);

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, { margin: 1, width: 512 })
      .then(setQr)
      .catch(() => setQr(''));
  }, [open, url]);

  useEffect(() => {
    if (!open || !markerPath) {
      setMarkerUrl('');
      return;
    }
    let active = true;
    setMarkerFailed(false);
    fetch(`/api/admin/ar/preview?path=${encodeURIComponent(markerPath)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active) return;
        if (d?.url) setMarkerUrl(d.url);
        else setMarkerFailed(true);
      })
      .catch(() => active && setMarkerFailed(true));
    return () => {
      active = false;
    };
  }, [open, markerPath]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Проверка с экрана: {title}</DialogTitle>
          <DialogDescription>
            Отсканируйте QR телефоном, затем наведите его камеру на картинку
            выше.
          </DialogDescription>
        </DialogHeader>

        {/* маркер — крупно, на светлой подложке: на тёмном фоне монитора
            контраст падает и распознавание идёт хуже */}
        <div className="grid min-h-72 place-items-center rounded-lg border bg-white p-3">
          {markerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={markerUrl}
              alt={`Маркер: ${title}`}
              className="max-h-[26rem] w-auto max-w-full"
              onError={() => setMarkerFailed(true)}
            />
          ) : markerFailed || !markerPath ? (
            <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
              <ImageOff className="h-6 w-6" />
              {markerPath ? 'Маркер не загрузился' : 'Маркер не задан'}
            </div>
          ) : (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="flex items-center gap-4 rounded-lg border p-3">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt="QR для запуска"
              className="h-32 w-32 shrink-0 rounded bg-white p-1"
            />
          ) : (
            <div className="h-32 w-32 shrink-0 animate-pulse rounded bg-muted" />
          )}
          <div className="min-w-0 space-y-2">
            <p className="font-mono text-xs break-all text-muted-foreground">
              {url}
            </p>
            <Button variant="outline" size="sm" asChild className="gap-2">
              <a href={`/ar/${slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} /> Открыть страницу здесь
              </a>
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Проверка с монитора показывает, что оживление вообще работает. Но
          подсветка экрана, блики и муар мешают распознаванию, поэтому
          окончательно оценивайте по напечатанному образцу — на бумаге маркер
          держится заметно увереннее.
        </p>
      </DialogContent>
    </Dialog>
  );
}

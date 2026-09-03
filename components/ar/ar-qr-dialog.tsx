'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Copy, ExternalLink } from 'lucide-react';
import { AR_SHORT_URL_BASE } from '@/lib/ar/config';

interface ArQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  shortCode: string | null;
  title: string;
}

// В QR уходит короткий безымянный код (/a/xxxxxxx), а не /ar/{slug}: на
// сувенирах для сторонних компаний по ссылке не читается ни наш бренд, ни
// название их товара. База — NEXT_PUBLIC_AR_SHORT_URL (можно направить на
// приложение отдельный нейтральный домен), иначе текущий origin.
export function arShortUrl(slug: string, shortCode: string | null) {
  const origin =
    AR_SHORT_URL_BASE ||
    (typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || 'https://starion-digital.com');
  // Пока код не выдан (запись создана до появления коротких ссылок) — обычный
  // адрес, чтобы кнопка «Просмотр» не вела в никуда.
  return shortCode ? `${origin}/a/${shortCode}` : `${origin}/ar/${slug}`;
}

export function ArQrDialog({
  open,
  onOpenChange,
  slug,
  shortCode,
  title,
}: ArQrDialogProps) {
  const [png, setPng] = useState('');
  const [svg, setSvg] = useState('');
  const url = arShortUrl(slug, shortCode);

  useEffect(() => {
    if (!open) return;
    const opts = { margin: 2, errorCorrectionLevel: 'M' as const };
    QRCode.toDataURL(url, { ...opts, width: 1024 })
      .then(setPng)
      .catch(() => setPng(''));
    QRCode.toString(url, { ...opts, type: 'svg' })
      .then(setSvg)
      .catch(() => setSvg(''));
  }, [open, url]);

  const download = (href: string, ext: string) => {
    const a = document.createElement('a');
    a.href = href;
    a.download = `ar-${slug}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadSvg = () => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const objectUrl = URL.createObjectURL(blob);
    download(objectUrl, 'svg');
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Ссылка скопирована');
    } catch {
      toast.error('Не удалось скопировать');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>QR-код: {title}</DialogTitle>
          <DialogDescription className="break-all">{url}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-2">
          {png ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={png}
              alt={`QR ${title}`}
              className="h-56 w-56 rounded-lg border bg-white p-2"
            />
          ) : (
            <div className="h-56 w-56 animate-pulse rounded-lg bg-muted" />
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => download(png, 'png')}
            disabled={!png}
            className="gap-2"
          >
            <Download size={16} /> PNG
          </Button>
          <Button
            variant="outline"
            onClick={downloadSvg}
            disabled={!svg}
            className="gap-2"
          >
            <Download size={16} /> SVG
          </Button>
          <Button variant="outline" onClick={copyLink} className="gap-2">
            <Copy size={16} /> Скопировать ссылку
          </Button>
          <Button variant="outline" asChild className="gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} /> Открыть
            </a>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Печатайте QR не меньше 2×2 см. SVG — для типографии (без потери
          качества), PNG — для быстрой печати и предпросмотра. Ссылка короткая и
          обезличенная — по ней не видно ни slug товара, ни раздела сайта.
        </p>
      </DialogContent>
    </Dialog>
  );
}

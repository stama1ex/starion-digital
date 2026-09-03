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
import { AR_DOMAIN_URL } from '@/lib/ar/domain';

interface ArQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  whiteLabel: boolean;
  title: string;
}

// Домен в QR выбирается тем же чекбоксом, что и брендинг во вьюере: белая
// метка уводит на отдельный домен (NEXT_PUBLIC_AR_SHORT_URL), свои сувениры
// остаются на основном — там наш адрес как раз к месту. Отдельный домен не
// настроен — везде текущий origin, работает и на проде, и на превью-деплоях.
export function arUrl(slug: string, whiteLabel = false) {
  const own =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || 'https://starion-digital.com';
  const origin = whiteLabel && AR_DOMAIN_URL ? AR_DOMAIN_URL : own;
  return `${origin}/ar/${slug}`;
}

export function ArQrDialog({
  open,
  onOpenChange,
  slug,
  whiteLabel,
  title,
}: ArQrDialogProps) {
  const [png, setPng] = useState('');
  const [svg, setSvg] = useState('');
  const url = arUrl(slug, whiteLabel);

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
          качества), PNG — для быстрой печати и предпросмотра.
        </p>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { Container } from '@/components/shared/container';
import { Title } from '@/components/shared/title';
import { Button } from '@/components/ui/button';
import { EditOrderDialog } from '@/components/shared/edit-order-dialog';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { useDropboxImage } from '@/lib/hooks/useDropboxImage';
import { Pencil, History } from 'lucide-react';

interface OrderChangeLogEntry {
  id: number;
  summary: string;
  createdAt: string;
  changedBy: { id: number; name: string; role: string } | null;
}

interface Order {
  id: number;
  createdAt: string;
  status: string;
  totalPrice: number;
  isRealization: boolean;
  changeLogs: OrderChangeLogEntry[];
  items: {
    quantity: number;
    sum: number;
    product: { number: string; image: string | null; country: string };
  }[];
}

function OrderItemImage({ imagePath }: { imagePath: string | null }) {
  const { imgSrc, loading } = useDropboxImage(imagePath);

  if (loading || !imgSrc) {
    return <div className="w-12.5 h-12.5 rounded-md bg-muted animate-pulse" />;
  }

  // Используем обычный img для Dropbox URL
  if (imgSrc.includes('dropboxusercontent.com')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imgSrc}
        width={50}
        height={50}
        className="rounded-md object-cover"
        alt=""
      />
    );
  }

  return (
    <Image
      src={imgSrc}
      width={50}
      height={50}
      className="rounded-md object-cover"
      alt=""
    />
  );
}

const MONTHS: Record<string, string[]> = {
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  ru: ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'],
  ro: ['ianuarie','februarie','martie','aprilie','mai','iunie','iulie','august','septembrie','octombrie','noiembrie','decembrie'],
};

function formatDate(date: string, locale: string) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = (MONTHS[locale] ?? MONTHS.en)[d.getMonth()];
  return `${day} ${month} ${d.getFullYear()}`;
}

export default function OrdersContent() {
  const t = useTranslations('Orders');
  const locale = useLocale();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);

  const loadOrders = useCallback(() => {
    return fetch('/api/order')
      .then((res) => res.json())
      .then((data) => setOrders(data.orders || []));
  }, []);

  useEffect(() => {
    loadOrders().finally(() => setLoading(false));
  }, [loadOrders]);

  if (loading)
    return (
      <Container className="py-12">
        <p className="text-center text-muted-foreground">{t('loading')}</p>
      </Container>
    );

  if (!orders.length)
    return (
      <Container className="py-12">
        <div className="flex justify-center w-full h-full">
          <Title
            text={t('title')}
            className="text-[28px] md:text-6xl font-extrabold leading-tight animate-gradient-flow text-center"
          />
        </div>
        <p className="text-center text-muted-foreground">{t('empty')}</p>
      </Container>
    );

  let lastDate = '';

  return (
    <Container className="py-12 px-4 md:px-0">
      <div className="flex justify-center w-full h-full">
        <Title
          text={t('title')}
          className="text-[28px] md:text-6xl font-extrabold leading-tight animate-gradient-flow text-center"
        />
      </div>

      <div className="flex flex-col gap-8">
        {orders.map((order) => {
          const dateStr = formatDate(order.createdAt, locale);
          const showDate = dateStr !== lastDate;
          lastDate = dateStr;

          return (
            <div key={order.id}>
              {showDate && (
                <>
                  <hr className="my-6 border-muted/40" />
                  <div className="text-sm text-muted-foreground mb-3 font-medium">
                    {dateStr}
                  </div>
                </>
              )}

              <div className="border rounded-lg p-4 bg-popover/40 hover:bg-popover/60 transition-all">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="text-lg font-semibold min-w-0 wrap-break-word">
                    {t('order')} № {order.id}
                  </div>

                  <span
                    className={cn(
                      'text-sm font-medium px-2 py-1 rounded-md shrink-0',
                      order.status === 'NEW' &&
                        'bg-yellow-500/20 text-yellow-600',
                      order.status === 'CONFIRMED' &&
                        'bg-blue-500/20 text-blue-600',
                      order.status === 'PAID' &&
                        'bg-green-500/20 text-green-600',
                      order.status === 'CANCELLED' &&
                        'bg-red-500/20 text-red-600'
                    )}
                  >
                    {t(`status.${order.status}`)}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {order.items.map((it, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {it.product.image && (
                          <OrderItemImage imagePath={it.product.image} />
                        )}
                        <div className="text-sm wrap-break-word">
                          {t('number')} {it.product.number} — {it.quantity}{' '}
                          {t('pcs')}
                        </div>
                      </div>

                      <div className="text-sm font-semibold text-primary shrink-0">
                        {it.sum} {t('currency_raw')}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t mt-4 pt-3 flex justify-between items-center gap-3 text-sm font-semibold">
                  <span>{t('total')}:</span>
                  <span className="text-primary">
                    {order.totalPrice} {t('currency_raw')}
                  </span>
                </div>

                {(order.status === 'NEW' || order.status === 'CONFIRMED') &&
                  !order.isRealization && (
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setEditingOrderId(order.id)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {t('edit')}
                      </Button>
                    </div>
                  )}

                {order.changeLogs.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t pt-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <History className="h-3.5 w-3.5" />
                      {t('history_title')}
                    </div>
                    {order.changeLogs.map((entry) => (
                      <p
                        key={entry.id}
                        className="text-xs text-muted-foreground wrap-break-word"
                      >
                        {formatDate(entry.createdAt, locale)} —{' '}
                        {entry.changedBy?.role === 'PARTNER'
                          ? t('changed_by_you')
                          : t('changed_by_staff')}
                        : {entry.summary}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editingOrderId !== null && (
        <EditOrderDialog
          orderId={editingOrderId}
          open={editingOrderId !== null}
          onOpenChange={(open) => {
            if (!open) setEditingOrderId(null);
          }}
          onSuccess={loadOrders}
        />
      )}
    </Container>
  );
}

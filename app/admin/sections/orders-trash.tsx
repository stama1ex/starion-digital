'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AdminAPI, formatDate, formatMDL, handleApiError } from '@/lib/admin';
import type { AdminOrder } from '../types';
import { useConfirm } from '@/app/providers/confirm-provider';

const TRASH_RETENTION_DAYS = 7;

function daysLeft(deletedAt: string) {
  const elapsedMs = Date.now() - new Date(deletedAt).getTime();
  const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  return Math.max(0, TRASH_RETENTION_DAYS - elapsedDays);
}

interface OrdersTrashProps {
  onRestored: () => void;
}

export default function OrdersTrash({ onRestored }: OrdersTrashProps) {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const confirm = useConfirm();

  const loadTrash = async () => {
    setLoading(true);
    try {
      const data = await AdminAPI.getTrashedOrders();
      setOrders(data.orders as AdminOrder[]);
    } catch (error) {
      const message = await handleApiError(error);
      toast.error(`Не удалось загрузить корзину: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrash();
  }, []);

  const handleRestore = async (orderId: number) => {
    setBusyId(orderId);
    try {
      await AdminAPI.restoreOrder(orderId);
      setOrders((prev) => prev?.filter((o) => o.id !== orderId) ?? null);
      toast.success(`Заказ №${orderId} восстановлен`);
      onRestored();
    } catch (error) {
      const message = await handleApiError(error);
      toast.error(`Ошибка при восстановлении: ${message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handlePurge = async (orderId: number) => {
    const ok = await confirm({
      description: `Заказ №${orderId} будет удалён навсегда, без возможности восстановления. Продолжить?`,
      confirmText: 'Удалить навсегда',
      variant: 'destructive',
    });
    if (!ok) return;

    setBusyId(orderId);
    try {
      await AdminAPI.purgeOrder(orderId);
      setOrders((prev) => prev?.filter((o) => o.id !== orderId) ?? null);
      toast.success(`Заказ №${orderId} удалён навсегда`);
    } catch (error) {
      const message = await handleApiError(error);
      toast.error(`Ошибка при удалении: ${message}`);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Загрузка корзины...
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center">
        Корзина пуста
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Удалённые заказы хранятся здесь {TRASH_RETENTION_DAYS} дней, затем
        удаляются окончательно.
      </p>

      {orders.map((order) => {
        const remaining = daysLeft(order.deletedAt as unknown as string);
        const isBusy = busyId === order.id;

        return (
          <Card key={order.id} className="py-1 border-dashed">
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    Заказ #{order.id}
                    {order.isMerged && ' (объединено)'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {order.partner.name} •{' '}
                    {formatMDL(Number(order.totalPrice))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Удалён {formatDate(order.deletedAt as unknown as string)}{' '}
                    •{' '}
                    {remaining > 0
                      ? `осталось ${remaining} дн.`
                      : 'будет удалён окончательно со дня на день'}
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => handleRestore(order.id)}
                    className="gap-2"
                  >
                    {isBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    Восстановить
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => handlePurge(order.id)}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Удалить навсегда
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

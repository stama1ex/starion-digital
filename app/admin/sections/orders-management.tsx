'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { AdminOrder } from '../types';

interface OrdersManagementProps {
  orders: AdminOrder[];
  onRefresh: () => void;
}

type OrderStatusType = 'NEW' | 'CONFIRMED' | 'PAID' | 'CANCELLED';

const STATUS_LABELS: Record<OrderStatusType, string> = {
  NEW: 'Новый',
  CONFIRMED: 'Подтверждён',
  PAID: 'Оплачен',
  CANCELLED: 'Отменён',
};

const STATUS_COLORS: Record<OrderStatusType, string> = {
  NEW: 'bg-yellow-500',
  CONFIRMED: 'bg-blue-500',
  PAID: 'bg-green-500',
  CANCELLED: 'bg-red-500',
};

export default function OrdersManagement({
  orders: initialOrders,
  onRefresh,
}: OrdersManagementProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState<OrderStatusType | 'ALL'>('ALL');
  const [updating, setUpdating] = useState<number | null>(null);

  const handleStatusChange = async (
    orderId: number,
    newStatus: OrderStatusType
  ) => {
    try {
      setUpdating(orderId);
      const res = await fetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: newStatus }),
      });

      if (res.ok) {
        // Обновляем локальное состояние
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  status: newStatus as unknown as typeof order.status,
                }
              : order
          )
        );
        onRefresh();
      } else {
        const error = await res.json();
        alert(`Ошибка: ${error.error || 'Не удалось обновить статус'}`);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Ошибка при обновлении статуса');
    } finally {
      setUpdating(null);
    }
  };

  const filteredOrders =
    filter === 'ALL'
      ? orders
      : orders.filter((order) => order.status === filter);

  // Группируем по статусам для статистики
  const stats = {
    NEW: orders.filter((o) => (o.status as string) === 'NEW').length,
    CONFIRMED: orders.filter((o) => (o.status as string) === 'CONFIRMED')
      .length,
    PAID: orders.filter((o) => (o.status as string) === 'PAID').length,
    CANCELLED: orders.filter((o) => (o.status as string) === 'CANCELLED')
      .length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <Card className="flex-1 min-w-[150px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Новые</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.NEW}</div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[150px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Подтверждённые
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.CONFIRMED}</div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[150px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Оплаченные</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.PAID}</div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[150px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Отменённые</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.CANCELLED}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Select
          value={filter}
          onValueChange={(v) => setFilter(v as OrderStatusType | 'ALL')}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Фильтр по статусу" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все заказы</SelectItem>
            <SelectItem value="NEW">Новые</SelectItem>
            <SelectItem value="CONFIRMED">Подтверждённые</SelectItem>
            <SelectItem value="PAID">Оплаченные</SelectItem>
            <SelectItem value="CANCELLED">Отменённые</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-center">
                Нет заказов для отображения
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">Заказ #{order.id}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {order.partner.name} •{' '}
                      {new Date(order.createdAt).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <Badge
                    className={
                      STATUS_COLORS[order.status as OrderStatusType] ||
                      'bg-gray-500'
                    }
                  >
                    {STATUS_LABELS[order.status as OrderStatusType] ||
                      order.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Товары:</h4>
                    <div className="space-y-1">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="text-sm flex justify-between"
                        >
                          <span>
                            {item.product.number} × {item.quantity}
                          </span>
                          <span>{Number(item.sum).toFixed(2)} MDL</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Общая сумма:
                      </p>
                      <p className="text-xl font-bold">
                        {Number(order.totalPrice).toFixed(2)} MDL
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium">Статус:</label>
                      <Select
                        value={order.status}
                        onValueChange={(value) =>
                          handleStatusChange(order.id, value as OrderStatusType)
                        }
                        disabled={updating === order.id}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NEW">Новый</SelectItem>
                          <SelectItem value="CONFIRMED">Подтверждён</SelectItem>
                          <SelectItem value="PAID">Оплачен</SelectItem>
                          <SelectItem value="CANCELLED">Отменён</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

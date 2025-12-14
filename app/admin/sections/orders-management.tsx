/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, X, Trash2, Download } from 'lucide-react';
import type { AdminOrder } from '../types';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  OrderStatusType,
  AdminAPI,
  usePartners,
  useProducts,
  handleApiError,
  formatDate,
} from '@/lib/admin';

interface OrdersManagementProps {
  orders: AdminOrder[];
  onRefresh: () => void;
}

export default function OrdersManagement({
  orders: initialOrders,
  onRefresh,
}: OrdersManagementProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState<OrderStatusType | 'ALL'>('ALL');
  const [updating, setUpdating] = useState<number | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { partners } = usePartners(true);
  const { products } = useProducts();
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [orderType, setOrderType] = useState<'regular' | 'realization'>(
    'regular'
  );
  const [orderItems, setOrderItems] = useState<
    { productId: number; qty: number }[]
  >([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (partners.length > 0 && !selectedPartnerId) {
      setSelectedPartnerId(partners[0].id.toString());
    }
  }, [partners, selectedPartnerId]);

  const handleAddItem = () => {
    if (products.length > 0) {
      setOrderItems([...orderItems, { productId: products[0].id, qty: 1 }]);
    }
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: 'productId' | 'qty',
    value: number
  ) => {
    const updated = [...orderItems];
    updated[index][field] = value;
    setOrderItems(updated);
  };

  const handleCreateOrder = async () => {
    if (!selectedPartnerId || orderItems.length === 0) {
      alert('Выберите партнера и добавьте товары');
      return;
    }

    try {
      setCreating(true);
      await AdminAPI.createOrder({
        partnerId: parseInt(selectedPartnerId),
        orderType,
        items: orderItems,
      });

      alert('Заказ создан успешно');
      setIsCreateDialogOpen(false);
      setOrderItems([]);
      setOrderType('regular');
      onRefresh();
    } catch (error) {
      const message = await handleApiError(error);
      alert(`Ошибка: ${message}`);
    } finally {
      setCreating(false);
    }
  };
  const handleStatusChange = async (
    orderId: number,
    newStatus: OrderStatusType
  ) => {
    try {
      setUpdating(orderId);
      await AdminAPI.updateOrderStatus({ orderId, status: newStatus });

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
    } catch (error) {
      const message = await handleApiError(error);
      alert(`Ошибка: ${message}`);
    } finally {
      setUpdating(null);
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    if (
      !confirm(
        'Вы уверены, что хотите удалить этот заказ? Это действие нельзя отменить.'
      )
    ) {
      return;
    }

    try {
      await AdminAPI.deleteOrder(orderId);
      setOrders((prev) => prev.filter((order) => order.id !== orderId));
      onRefresh();
    } catch (error) {
      const message = await handleApiError(error);
      alert(`Ошибка: ${message}`);
    }
  };

  const handleExportOrder = async (order: AdminOrder) => {
    try {
      const response = await fetch('/api/admin/orders/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId: order.id }),
      });

      if (!response.ok) {
        // Проверяем Content-Type перед парсингом
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(
            errorData.details || errorData.error || 'Ошибка экспорта'
          );
        } else {
          throw new Error(`Ошибка сервера: ${response.status}`);
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Заказ_${order.id}_${order.partner.name}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting order:', error);
      const message =
        error instanceof Error ? error.message : 'Неизвестная ошибка';
      alert(`Ошибка при экспорте заказа: ${message}`);
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
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Заказы</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
          <Plus size={16} />
          Создать заказ
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Card className="flex-1 min-w-[150px] p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Новые
            </span>
            <span className="text-2xl font-bold">{stats.NEW}</span>
          </div>
        </Card>
        <Card className="flex-1 min-w-[150px] p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Подтверждённые
            </span>
            <span className="text-2xl font-bold">{stats.CONFIRMED}</span>
          </div>
        </Card>
        <Card className="flex-1 min-w-[150px] p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Оплаченные
            </span>
            <span className="text-2xl font-bold">{stats.PAID}</span>
          </div>
        </Card>
        <Card className="flex-1 min-w-[150px] p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Отменённые
            </span>
            <span className="text-2xl font-bold">{stats.CANCELLED}</span>
          </div>
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

      <div className="space-y-2">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-center">
                Нет заказов для отображения
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const totalItems = order.items.reduce(
              (sum, item) => sum + item.quantity,
              0
            );

            return (
              <Card
                key={order.id}
                className="py-1 cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
              >
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-4">
                    {/* Левая часть: номер, партнер, дата */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">Заказ #{order.id}</span>
                        <Badge
                          className={`${
                            ORDER_STATUS_COLORS[
                              order.status as OrderStatusType
                            ] || 'bg-gray-500'
                          } text-xs`}
                        >
                          {ORDER_STATUS_LABELS[
                            order.status as OrderStatusType
                          ] || order.status}
                        </Badge>
                        {(order as any).isRealization && (
                          <Badge className="bg-transparent border border-purple-400 text-xs text-purple-400">
                            На реализацию
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 truncate">
                        {order.partner.name} • {formatDate(order.createdAt)}
                      </p>
                    </div>

                    <div className="flex flex-col md:flex-row gap-3 md:gap-6 items-center">
                      {/* Центр: количество товаров */}
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Товаров</p>
                        <p className="font-semibold">{totalItems} шт</p>
                      </div>

                      {/* Правая часть: сумма */}
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Сумма</p>
                        <p className="font-semibold">
                          {Number(order.totalPrice).toFixed(2)} MDL
                        </p>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-3 border-t pt-3">
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

                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Общая сумма:
                          </p>
                          <p className="text-xl font-bold">
                            {Number(order.totalPrice).toFixed(2)} MDL
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                          {(order as any).isRealization &&
                          order.status === 'PAID' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                Заказ полностью оплачен
                              </span>
                            </div>
                          ) : (
                            <div
                              className="flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <label className="text-sm font-medium whitespace-nowrap">
                                Статус:
                              </label>
                              <Select
                                value={order.status}
                                onValueChange={(value) =>
                                  handleStatusChange(
                                    order.id,
                                    value as OrderStatusType
                                  )
                                }
                                disabled={updating === order.id}
                              >
                                <SelectTrigger className="w-full sm:w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="NEW">Новый</SelectItem>
                                  <SelectItem value="CONFIRMED">
                                    Подтверждён
                                  </SelectItem>
                                  {/* PAID доступен только для обычных заказов вручную */}
                                  {!(order as any).isRealization && (
                                    <SelectItem value="PAID">
                                      Оплачен
                                    </SelectItem>
                                  )}
                                  <SelectItem value="CANCELLED">
                                    Отменён
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Кнопка экспорта */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportOrder(order);
                            }}
                            title="Экспорт в Excel"
                          >
                            <Download className="h-4 w-4 sm:mr-0 mr-2" />
                            <span className="sm:hidden">Экспорт</span>
                          </Button>

                          {/* Кнопка удаления для отмененных заказов */}
                          {order.status === 'CANCELLED' && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteOrder(order.id);
                              }}
                              title="Удалить заказ"
                            >
                              <Trash2 className="h-4 w-4 sm:mr-0 mr-2" />
                              <span className="sm:hidden">Удалить заказ</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Create Order Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Создать заказ</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Partner Selection */}
            <div>
              <Label htmlFor="partner-select" className="mb-2">
                От имени
              </Label>
              <Select
                value={selectedPartnerId}
                onValueChange={setSelectedPartnerId}
              >
                <SelectTrigger id="partner-select">
                  <SelectValue placeholder="Выберите партнёра" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id.toString()}>
                      {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Order Type Selection */}
            <div>
              <Label htmlFor="order-type" className="mb-2">
                Тип заказа
              </Label>
              <Select
                value={orderType}
                onValueChange={(val) =>
                  setOrderType(val as 'regular' | 'realization')
                }
              >
                <SelectTrigger id="order-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Обычный заказ</SelectItem>
                  <SelectItem value="realization">Заказ реализации</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Order Items */}
            <div className="space-y-2">
              <Label>Товары</Label>
              {orderItems.map((item, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Select
                      value={item.productId?.toString() || ''}
                      onValueChange={(val) =>
                        handleItemChange(index, 'productId', parseInt(val))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите товар" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem
                            key={product.id}
                            value={product.id.toString()}
                          >
                            {product.number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      placeholder="Кол-во"
                      min="1"
                      value={item.qty || ''}
                      onChange={(e) =>
                        handleItemChange(
                          index,
                          'qty',
                          parseInt(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Новый товар
              </Button>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Отмена
              </Button>
              <Button
                onClick={handleCreateOrder}
                disabled={
                  creating ||
                  !selectedPartnerId ||
                  orderItems.length === 0 ||
                  orderItems.some((item) => !item.productId || !item.qty)
                }
              >
                {creating ? 'Создание...' : 'Создать заказ'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

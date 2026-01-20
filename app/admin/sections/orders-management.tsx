/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
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
import { Plus, Trash2, Download, Pencil, DollarSign } from 'lucide-react';
import { OrderCustomPricesDialog } from '@/components/admin/order-custom-prices-dialog';
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
  PRODUCT_TYPES,
  PRODUCT_TYPE_LABELS_PLURAL,
} from '@/lib/admin';
import { ProductGroup } from '@prisma/client';

interface OrdersManagementProps {
  orders: AdminOrder[];
  onRefresh: () => void;
  groups: ProductGroup[];
}

export default function OrdersManagement({
  orders: initialOrders,
  onRefresh,
  groups,
}: OrdersManagementProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState<OrderStatusType | 'ALL'>('ALL');
  const [updating, setUpdating] = useState<number | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { partners } = usePartners(true);
  const { products } = useProducts();
  // const { groups } = useGroups(); // Now passed as prop
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [orderType, setOrderType] = useState<'regular' | 'realization'>(
    'regular',
  );
  const [creating, setCreating] = useState(false);
  const [partnerSearchQuery, setPartnerSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderDate, setOrderDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [isEditNotesDialogOpen, setIsEditNotesDialogOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [editNotesValue, setEditNotesValue] = useState('');
  const [updatingNotes, setUpdatingNotes] = useState(false);
  const [isEditPricesDialogOpen, setIsEditPricesDialogOpen] = useState(false);
  const [editingPricesOrder, setEditingPricesOrder] =
    useState<AdminOrder | null>(null);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);
  useEffect(() => {
    if (partners.length > 0 && !selectedPartnerId) {
      setSelectedPartnerId(partners[0].id.toString());
    }
  }, [partners, selectedPartnerId]);

  useEffect(() => {
    // Initialize quantities when dialog opens
    if (isCreateDialogOpen) {
      const initialQuantities: Record<number, number> = {};
      products.forEach((product) => {
        initialQuantities[product.id] = 0;
      });
      setQuantities(initialQuantities);
    }
  }, [isCreateDialogOpen, products]);

  const handleQuantityChange = (productId: number, value: string) => {
    const qty = parseInt(value) || 0;
    setQuantities((prev) => ({
      ...prev,
      [productId]: Math.max(0, qty),
    }));
  };

  const handleOpenEditNotes = (
    orderId: number,
    currentNotes: string | null,
  ) => {
    setEditingOrderId(orderId);
    setEditNotesValue(currentNotes || '');
    setIsEditNotesDialogOpen(true);
  };

  const handleOpenEditPrices = (order: AdminOrder) => {
    setEditingPricesOrder(order);
    setIsEditPricesDialogOpen(true);
  };

  useEffect(() => {
    if (!isEditPricesDialogOpen) {
      setEditingPricesOrder(null);
    }
  }, [isEditPricesDialogOpen]);

  const handleUpdateNotes = async () => {
    if (!editingOrderId) return;

    try {
      setUpdatingNotes(true);
      const response = await fetch('/api/admin/orders/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: editingOrderId,
          notes: editNotesValue.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      setOrders((prev) =>
        prev.map((order) =>
          order.id === editingOrderId
            ? { ...order, notes: editNotesValue.trim() || null }
            : order,
        ),
      );
      setIsEditNotesDialogOpen(false);
      onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка';
      toast.error(`Ошибка при обновлении примечания: ${message}`);
    } finally {
      setUpdatingNotes(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!selectedPartnerId) {
      toast.error('Выберите партнера');
      return;
    }

    // Collect items with qty > 0
    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => ({
        productId: parseInt(productId),
        qty,
      }));

    if (items.length === 0) {
      toast.error('Добавьте хотя бы один товар');
      return;
    }

    const requestData = {
      partnerId: parseInt(selectedPartnerId),
      orderType,
      items,
      notes: orderNotes.trim() || undefined,
      createdAt: orderDate ? new Date(orderDate).toISOString() : undefined,
    };

    console.log('Creating order with data:', requestData);

    try {
      setCreating(true);
      const response = await fetch('/api/admin/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        throw new Error(errorText || 'Failed to create order');
      }

      const result = await response.json();
      console.log('Order created:', result);

      toast.success('Заказ создан успешно');
      setIsCreateDialogOpen(false);
      setOrderType('regular');
      setPartnerSearchQuery('');
      setProductSearchQuery('');
      setOrderNotes('');
      setOrderDate(new Date().toISOString().split('T')[0]);
      setSelectedGroupId('all');
      setQuantities({});
      onRefresh();
    } catch (error) {
      console.error('Error creating order:', error);
      const message =
        error instanceof Error ? error.message : 'Неизвестная ошибка';
      toast.error(`Ошибка при создании заказа: ${message}`);
    } finally {
      setCreating(false);
    }
  };
  const handleStatusChange = async (
    orderId: number,
    newStatus: OrderStatusType,
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
            : order,
        ),
      );
      onRefresh();
    } catch (error) {
      const message = await handleApiError(error);
      toast.error(`Ошибка: ${message}`);
    } finally {
      setUpdating(null);
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    if (
      !confirm(
        'Вы уверены, что хотите удалить этот заказ? Это действие нельзя отменить.',
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
      toast.error(`Ошибка: ${message}`);
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
            errorData.details || errorData.error || 'Ошибка экспорта',
          );
        } else {
          throw new Error(`Ошибка сервера: ${response.status}`);
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Форматируем дату для имени файла
      const date = new Date(order.createdAt);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const formattedDate = `${day}.${month}.${year}`;

      a.download = `Заказ_${order.id}_${order.partner.name}_${formattedDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting order:', error);
      const message =
        error instanceof Error ? error.message : 'Неизвестная ошибка';
      toast.error(`Ошибка при экспорте заказа: ${message}`);
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

  // Фильтрация партнеров по поиску
  const filteredPartners = partners.filter((partner) =>
    partner.name.toLowerCase().includes(partnerSearchQuery.toLowerCase()),
  );

  // Фильтрация товаров
  const getFilteredProducts = () => {
    let filtered = products;

    // Фильтр по типу товара
    if (selectedTypeFilter !== 'ALL') {
      filtered = filtered.filter((p) => p.type === selectedTypeFilter);
    }

    // Фильтр по группе
    if (selectedGroupId !== 'all') {
      if (selectedGroupId === 'no-group') {
        filtered = filtered.filter((p) => !p.groupId);
      } else {
        filtered = filtered.filter(
          (p) => p.groupId === parseInt(selectedGroupId),
        );
      }
    }

    // Фильтр по поисковому запросу
    if (productSearchQuery) {
      filtered = filtered.filter((product) =>
        product.number.toLowerCase().includes(productSearchQuery.toLowerCase()),
      );
    }

    return filtered;
  };

  const filteredProducts = getFilteredProducts();

  // Подсчет итогов
  const getTotals = () => {
    if (!selectedPartnerId) return { totalItems: 0, totalSum: 0 };

    const partner = partners.find((p) => p.id === parseInt(selectedPartnerId));
    if (!partner || !partner.prices) return { totalItems: 0, totalSum: 0 };

    let totalItems = 0;
    let totalSum = 0;

    Object.entries(quantities).forEach(([productIdStr, qty]) => {
      if (qty > 0) {
        const productId = parseInt(productIdStr);
        const product = products.find((p) => p.id === productId);
        if (product) {
          totalItems += qty;
          // Find price for this product
          const priceEntry = partner.prices.find(
            (p: any) =>
              p.type === product.type && p.groupId === product.groupId,
          );
          if (priceEntry) {
            totalSum += qty * Number(priceEntry.price);
          }
        }
      }
    });

    return { totalItems, totalSum };
  };

  // Подсчет итогов по типам
  const getTotalsByType = () => {
    if (!selectedPartnerId) return {};

    const partner = partners.find((p) => p.id === parseInt(selectedPartnerId));
    if (!partner || !partner.prices) return {};

    const byType: Record<string, { count: number; sum: number }> = {};

    Object.entries(quantities).forEach(([productIdStr, qty]) => {
      if (qty > 0) {
        const productId = parseInt(productIdStr);
        const product = products.find((p) => p.id === productId);
        if (product) {
          if (!byType[product.type]) {
            byType[product.type] = { count: 0, sum: 0 };
          }
          byType[product.type].count += qty;

          const priceEntry = partner.prices.find(
            (p: any) =>
              p.type === product.type && p.groupId === product.groupId,
          );
          if (priceEntry) {
            byType[product.type].sum += qty * Number(priceEntry.price);
          }
        }
      }
    });

    return byType;
  };

  const { totalItems, totalSum } = getTotals();
  const totalsByType = getTotalsByType();

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold">Заказы</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
          <Plus size={16} />
          Создать заказ
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Card className="flex-1 min-w-37.5 px-3 py-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Новые
            </span>
            <span className="text-2xl font-bold">{stats.NEW}</span>
          </div>
        </Card>
        <Card className="flex-1 min-w-37.5 px-3 py-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Подтверждённые
            </span>
            <span className="text-2xl font-bold">{stats.CONFIRMED}</span>
          </div>
        </Card>
        <Card className="flex-1 min-w-37.5 px-3 py-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Оплаченные
            </span>
            <span className="text-2xl font-bold">{stats.PAID}</span>
          </div>
        </Card>
        <Card className="flex-1 min-w-37.5 px-3 py-1">
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
              0,
            );

            return (
              <Card
                key={order.id}
                className="py-1 cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
              >
                <CardContent>
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
                      {/* Order Notes */}
                      <div className="bg-secondary p-3 rounded">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Примечание:
                            </p>
                            <p className="text-sm">
                              {order.notes || (
                                <span className="text-muted-foreground italic">
                                  Нет примечания
                                </span>
                              )}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditNotes(order.id, order.notes);
                            }}
                            title="Редактировать примечание"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

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
                          {/* Кнопка редактирования цен */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditPrices(order);
                            }}
                            title="Редактировать цены для этого заказа"
                          >
                            <DollarSign className="h-4 w-4 sm:mr-0 mr-2" />
                            <span className="sm:hidden">Цены</span>
                          </Button>

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
                                    value as OrderStatusType,
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
        <DialogContent className="max-w-[95vw] lg:max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Создать новый заказ</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left side - Form fields */}
            <div className="space-y-4 flex-1">
              {/* Partner Selection */}
              <div>
                <Label htmlFor="partner-search" className="mb-2">
                  Партнёр
                </Label>
                <Input
                  id="partner-search"
                  type="text"
                  placeholder="Поиск по названию партнёра..."
                  value={partnerSearchQuery}
                  onChange={(e) => setPartnerSearchQuery(e.target.value)}
                  className="mb-2"
                />
                <Select
                  value={selectedPartnerId}
                  onValueChange={setSelectedPartnerId}
                >
                  <SelectTrigger id="partner-select">
                    <SelectValue placeholder="Выберите партнёра" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredPartners.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        Партнёры не найдены
                      </div>
                    ) : (
                      filteredPartners.map((partner) => (
                        <SelectItem
                          key={partner.id}
                          value={partner.id.toString()}
                        >
                          {partner.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Order Type */}
              <div>
                <Label htmlFor="order-type" className="mb-1">
                  Тип заказа
                </Label>
                <Select
                  value={orderType}
                  onValueChange={(v) =>
                    setOrderType(v as 'regular' | 'realization')
                  }
                >
                  <SelectTrigger id="order-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Обычный</SelectItem>
                    <SelectItem value="realization">На реализацию</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="order-notes" className="mb-1">
                  Примечание (необязательно)
                </Label>
                <Input
                  id="order-notes"
                  type="text"
                  placeholder="Введите примечание к заказу..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                />
              </div>

              {/* Date Selection */}
              <div>
                <Label htmlFor="order-date" className="mb-1">
                  Дата заказа
                </Label>
                <Input
                  id="order-date"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-fit"
                />
              </div>

              {/* Totals Summary */}
              <Card className="bg-secondary">
                <CardContent>
                  <h4 className="font-semibold mb-3">Итого по типам:</h4>
                  <div className="space-y-2">
                    {PRODUCT_TYPES.map((type) => {
                      const typeData = totalsByType[type];
                      if (!typeData || typeData.count === 0) return null;
                      return (
                        <div
                          key={type}
                          className="flex justify-between text-sm"
                        >
                          <span>{PRODUCT_TYPE_LABELS_PLURAL[type]}:</span>
                          <span className="font-medium">
                            {typeData.count} шт • {typeData.sum.toFixed(2)} MDL
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t mt-3 pt-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Всего товаров
                      </p>
                      <p className="text-xl font-bold">{totalItems} шт</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        Итоговая сумма
                      </p>
                      <p className="text-xl font-bold">
                        {totalSum.toFixed(2)} MDL
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right side - Filters, Products grid and totals */}
            <div className="space-y-4 flex-1 lg:min-w-112.5">
              {/* Filters */}
              <div className="flex gap-3">
                {/* Product Search */}
                <div>
                  <Label htmlFor="product-search" className="mb-1">
                    Поиск товара
                  </Label>
                  <Input
                    id="product-search"
                    type="text"
                    placeholder="Поиск товара по номеру..."
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                  />
                </div>
                {/* Product Type Filter */}
                <div>
                  <Label htmlFor="type-filter" className="mb-1">
                    Тип товара
                  </Label>
                  <Select
                    value={selectedTypeFilter}
                    onValueChange={(value) => {
                      setSelectedTypeFilter(value);
                      setSelectedGroupId('all');
                    }}
                  >
                    <SelectTrigger id="type-filter">
                      <SelectValue placeholder="Все типы" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Все типы</SelectItem>
                      {PRODUCT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {PRODUCT_TYPE_LABELS_PLURAL[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Group Filter */}
                <div>
                  <Label htmlFor="group-filter" className="mb-1">
                    Группа товаров
                  </Label>
                  <Select
                    value={selectedGroupId}
                    onValueChange={setSelectedGroupId}
                    disabled={selectedTypeFilter === 'ALL'}
                  >
                    <SelectTrigger id="group-filter">
                      <SelectValue placeholder="Выберите группу" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все группы</SelectItem>
                      <SelectItem value="no-group">Без группы</SelectItem>
                      {groups
                        .filter(
                          (group) =>
                            selectedTypeFilter === 'ALL' ||
                            group.type === selectedTypeFilter,
                        )
                        .map((group) => (
                          <SelectItem
                            key={group.id}
                            value={group.id.toString()}
                          >
                            {(group.translations as { ru?: string })?.ru ||
                              group.slug}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Products Grid */}
              <div className="border rounded-lg p-4 max-h-150 overflow-y-auto">
                <h4 className="font-semibold mb-3">
                  Товары ({filteredProducts.length})
                </h4>
                {filteredProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Товары не найдены
                  </p>
                ) : (
                  <div className="columns-3 sm:columns-4 gap-2">
                    {filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        className="break-inside-avoid mb-0 flex items-center justify-between p-1 border rounded"
                      >
                        <label
                          htmlFor={`qty-${product.id}`}
                          className="text-xs font-medium truncate pl-1"
                          title={product.number}
                        >
                          {product.number}
                        </label>
                        <Input
                          id={`qty-${product.id}`}
                          type="number"
                          min="0"
                          value={quantities[product.id] || 0}
                          onChange={(e) =>
                            handleQuantityChange(product.id, e.target.value)
                          }
                          onFocus={(e) => e.currentTarget.select()}
                          className="h-6 min-w-12 max-w-12 text-xs px-1 text-center"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setOrderNotes('');
                setOrderDate(new Date().toISOString().split('T')[0]);
                setSelectedGroupId('all');
                setSelectedTypeFilter('ALL');
                setProductSearchQuery('');
                setPartnerSearchQuery('');
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={handleCreateOrder}
              disabled={creating || !selectedPartnerId || totalItems === 0}
            >
              {creating ? 'Создание...' : 'Создать заказ'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Notes Dialog */}
      <Dialog
        open={isEditNotesDialogOpen}
        onOpenChange={setIsEditNotesDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Редактировать примечание</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-notes">Примечание к заказу</Label>
              <Input
                id="edit-notes"
                type="text"
                placeholder="Введите примечание..."
                value={editNotesValue}
                onChange={(e) => setEditNotesValue(e.target.value)}
                className="mt-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditNotesDialogOpen(false)}
              >
                Отмена
              </Button>
              <Button onClick={handleUpdateNotes} disabled={updatingNotes}>
                {updatingNotes ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Prices Dialog */}
      {editingPricesOrder && (
        <OrderCustomPricesDialog
          open={isEditPricesDialogOpen}
          onOpenChange={setIsEditPricesDialogOpen}
          order={editingPricesOrder}
          groups={groups}
          onSuccess={(updatedOrder) => {
            if (updatedOrder) {
              setOrders((prev) =>
                prev.map((o) =>
                  o.id === updatedOrder.id ? (updatedOrder as any) : o,
                ),
              );
              setEditingPricesOrder(updatedOrder as any);
            }
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

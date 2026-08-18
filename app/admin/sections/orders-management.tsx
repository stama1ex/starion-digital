/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Fragment, useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
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
import {
  Plus,
  Trash2,
  Download,
  Pencil,
  DollarSign,
  Check,
  ChevronDown,
  Search,
  Phone,
  MapPin,
  GitMerge,
  TriangleAlert,
  History,
  FlaskConical,
} from 'lucide-react';
import { OrderCustomPricesDialog } from '@/components/admin/order-custom-prices-dialog';
import { EditOrderDialog } from '@/components/shared/edit-order-dialog';
import { VAT_RATE } from '@/lib/orders/pricing';
import { formatMDL, formatMoney } from '@/lib/format-money';
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
  isTestPartnerName,
} from '@/lib/admin';
import { ProductGroup } from '@prisma/client';
import { useConfirm } from '@/app/providers/confirm-provider';
import { cn } from '@/lib/utils';
import { naturalCompare } from '@/lib/naturalSort';

interface OrdersManagementProps {
  orders: AdminOrder[];
  onRefresh: () => void;
  groups: ProductGroup[];
  // Полное управление заказами (смена статуса, примечания, кастомные цены,
  // объединение, удаление) - только для супер-админа. Ограниченный админ
  // может только видеть список, создавать новые заказы и экспортировать.
  canManage?: boolean;
}

export default function OrdersManagement({
  orders: initialOrders,
  onRefresh,
  groups,
  canManage = true,
}: OrdersManagementProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState<OrderStatusType | 'ALL'>('ALL');
  const [updating, setUpdating] = useState<number | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { partners } = usePartners(true);
  const { products } = useProducts();
  const confirm = useConfirm();
  // const { groups } = useGroups(); // Now passed as prop
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [orderType, setOrderType] = useState<'regular' | 'realization'>(
    'regular',
  );
  const [orderHasVat, setOrderHasVat] = useState(false);
  const [creating, setCreating] = useState(false);
  const [partnerSearchQuery, setPartnerSearchQuery] = useState('');
  const [isPartnerComboboxOpen, setIsPartnerComboboxOpen] = useState(false);
  const [orderPartnerSearchQuery, setOrderPartnerSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderAddress, setOrderAddress] = useState('');
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
  const [loadedOrdersCount, setLoadedOrdersCount] = useState(20);
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedMergeIds, setSelectedMergeIds] = useState<number[]>([]);
  const [merging, setMerging] = useState(false);
  const [editingItemsOrderId, setEditingItemsOrderId] = useState<number | null>(
    null,
  );
  const partnerComboboxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        partnerComboboxRef.current &&
        !partnerComboboxRef.current.contains(event.target as Node)
      ) {
        setIsPartnerComboboxOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQuantityChange = (productId: number, value: string) => {
    const qty = parseInt(value) || 0;
    setQuantities((prev) => ({
      ...prev,
      [productId]: Math.max(0, qty),
    }));
  };

  const handleQuantityKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const nextProduct = filteredProducts[index + 1];
    if (nextProduct) {
      document.getElementById(`qty-${nextProduct.id}`)?.focus();
    } else {
      e.currentTarget.blur();
    }
  };

  const handleLoadLastOrder = () => {
    if (!lastPartnerOrder) return;

    const nextQuantities: Record<number, number> = {};
    products.forEach((product) => {
      nextQuantities[product.id] = 0;
    });
    lastPartnerOrder.items.forEach((item) => {
      nextQuantities[item.productId] = item.quantity;
    });
    setQuantities(nextQuantities);
    setOrderType(lastPartnerOrder.isRealization ? 'realization' : 'regular');
    setOrderHasVat(lastPartnerOrder.hasVat);

    toast.success(
      `Позиции заполнены как в заказе №${lastPartnerOrder.id} от ${formatDate(lastPartnerOrder.createdAt)}`,
    );
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
      hasVat: orderType === 'regular' && orderHasVat,
      items,
      notes: orderNotes.trim() || undefined,
      address: orderAddress.trim() || undefined,
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
      setOrderHasVat(false);
      setPartnerSearchQuery('');
      setProductSearchQuery('');
      setOrderNotes('');
      setOrderAddress('');
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
    const ok = await confirm({
      description:
        'Заказ будет перемещён в корзину и окончательно удалён через 7 дней. Восстановить его можно на вкладке "Корзина".',
      confirmText: 'Удалить',
      variant: 'destructive',
    });
    if (!ok) return;

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

  // Партнёр, к которому уже привязан текущий выбор для объединения
  const mergePartnerId =
    selectedMergeIds.length > 0
      ? orders.find((o) => o.id === selectedMergeIds[0])?.partnerId
      : null;

  const isEligibleForMerge = (order: AdminOrder) =>
    !(order as any).isRealization &&
    (order.status === 'NEW' || order.status === 'CONFIRMED') &&
    (mergePartnerId == null || order.partnerId === mergePartnerId);

  const handleToggleMergeSelect = (orderId: number) => {
    setSelectedMergeIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId],
    );
  };

  const handleToggleMergeMode = () => {
    setMergeMode((prev) => !prev);
    setSelectedMergeIds([]);
  };

  const handleMergeOrders = async () => {
    if (selectedMergeIds.length < 2) return;

    const ok = await confirm({
      description: `Объединить ${selectedMergeIds.length} заказа(ов) в один? Все товары сложатся в самый ранний из выбранных заказов, а остальные будут безвозвратно удалены (в примечании останется пометка, из каких заказов было объединение).`,
      confirmText: 'Объединить',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      setMerging(true);
      const result = await AdminAPI.mergeOrders(selectedMergeIds);
      toast.success(`Заказы объединены в заказ №${result.order.id}`);
      setSelectedMergeIds([]);
      setMergeMode(false);
      onRefresh();
    } catch (error) {
      const message = await handleApiError(error);
      toast.error(`Ошибка при объединении заказов: ${message}`);
    } finally {
      setMerging(false);
    }
  };

  const filteredOrders =
    filter === 'ALL'
      ? orders
      : orders.filter((order) => order.status === filter);

  const visibleOrders = filteredOrders.filter((order) => {
    const query = orderPartnerSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      order.partner.name.toLowerCase().includes(query) ||
      order.id.toString() === query.replace(/^#/, '')
    );
  });

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

  const selectedPartnerName =
    partners.find((partner) => partner.id.toString() === selectedPartnerId)
      ?.name || 'Выберите партнёра';

  const handleOpenPartnerCombobox = () => {
    setIsPartnerComboboxOpen((open) => !open);
    setPartnerSearchQuery('');
  };

  const handleSelectPartner = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    setPartnerSearchQuery('');
    setIsPartnerComboboxOpen(false);

    const partner = partners.find((p) => p.id.toString() === partnerId);
    setOrderAddress(partner?.address || '');
  };

  const selectedPartner = partners.find(
    (p) => p.id.toString() === selectedPartnerId,
  );

  // Последний заказ выбранного партнёра — чтобы можно было быстро
  // заполнить новый заказ теми же позициями и поправить пару вещей.
  const lastPartnerOrder = selectedPartnerId
    ? [...orders]
        .filter((o) => o.partnerId === parseInt(selectedPartnerId))
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0]
    : undefined;

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

  // Множитель НДС для предпросмотра суммы (реализация НДС не поддерживает)
  const vatMultiplier =
    orderType === 'regular' && orderHasVat ? 1 + VAT_RATE : 1;

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
            totalSum += qty * Number(priceEntry.price) * vatMultiplier;
          }
        }
      }
    });

    return { totalItems, totalSum };
  };

  // Подсчет итогов по типам, с разбивкой по подтипам (группам/материалам)
  const getTotalsByType = () => {
    if (!selectedPartnerId) return {};

    const partner = partners.find((p) => p.id === parseInt(selectedPartnerId));
    if (!partner || !partner.prices) return {};

    type GroupTotal = {
      groupId: number | null;
      groupName: string;
      count: number;
      sum: number;
    };
    const byType: Record<
      string,
      { count: number; sum: number; byGroup: Record<string, GroupTotal> }
    > = {};

    Object.entries(quantities).forEach(([productIdStr, qty]) => {
      if (qty > 0) {
        const productId = parseInt(productIdStr);
        const product = products.find((p) => p.id === productId);
        if (product) {
          if (!byType[product.type]) {
            byType[product.type] = { count: 0, sum: 0, byGroup: {} };
          }
          byType[product.type].count += qty;

          const priceEntry = partner.prices.find(
            (p: any) =>
              p.type === product.type && p.groupId === product.groupId,
          );
          const itemSum = priceEntry
            ? qty * Number(priceEntry.price) * vatMultiplier
            : 0;
          byType[product.type].sum += itemSum;

          const groupKey = String(product.groupId ?? 'none');
          if (!byType[product.type].byGroup[groupKey]) {
            const group = groups.find((g) => g.id === product.groupId);
            byType[product.type].byGroup[groupKey] = {
              groupId: product.groupId ?? null,
              groupName:
                (group?.translations as any)?.ru || group?.slug || 'Без группы',
              count: 0,
              sum: 0,
            };
          }
          byType[product.type].byGroup[groupKey].count += qty;
          byType[product.type].byGroup[groupKey].sum += itemSum;
        }
      }
    });

    return byType;
  };

  const { totalItems, totalSum } = getTotals();
  const totalsByType = getTotalsByType();

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-2">
        <h2 className="text-2xl font-bold">Заказы</h2>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Button
              variant={mergeMode ? 'secondary' : 'outline'}
              onClick={handleToggleMergeMode}
              className="gap-2"
            >
              <GitMerge size={16} />
              {mergeMode ? 'Отменить объединение' : 'Объединить заказы'}
            </Button>
          )}
          <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
            <Plus size={16} />
            Создать заказ
          </Button>
        </div>
      </div>

      {mergeMode && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-1">
            <p className="text-sm">
              {selectedMergeIds.length === 0
                ? 'Выберите минимум 2 заказа одного партнёра, чтобы объединить их товары в один заказ'
                : `Выбрано заказов: ${selectedMergeIds.length}${
                    mergePartnerId
                      ? ` • ${
                          partners.find((p) => p.id === mergePartnerId)?.name ||
                          ''
                        }`
                      : ''
                  }`}
            </p>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedMergeIds([])}
                disabled={selectedMergeIds.length === 0 || merging}
              >
                Сбросить выбор
              </Button>
              <Button
                size="sm"
                onClick={handleMergeOrders}
                disabled={selectedMergeIds.length < 2 || merging}
              >
                {merging ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Объединение...
                  </>
                ) : (
                  `Объединить (${selectedMergeIds.length})`
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

      <div className="flex flex-col sm:flex-row gap-2 sm:justify-between">
        <div className="w-full sm:flex-1 sm:max-w-xs">
          <Input
            value={orderPartnerSearchQuery}
            onChange={(e) => setOrderPartnerSearchQuery(e.target.value)}
            placeholder="Поиск по партнёру или №заказа..."
          />
        </div>

        <Select
          value={filter}
          onValueChange={(v) => setFilter(v as OrderStatusType | 'ALL')}
        >
          <SelectTrigger className="w-full sm:w-64">
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
        {visibleOrders.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-center">
                Нет заказов для отображения
              </p>
            </CardContent>
          </Card>
        ) : (
          visibleOrders.slice(0, loadedOrdersCount).map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const totalItems = order.items.reduce(
              (sum, item) => sum + item.quantity,
              0,
            );

            const mergeEligible = isEligibleForMerge(order);

            const hasMarginIssue = order.items.some(
              (item) =>
                Number(item.pricePerItem) < Number(item.product.costPrice),
            );

            const sortedItems = [...order.items].sort((a, b) =>
              naturalCompare(a.product.number, b.product.number),
            );

            // Группировка товаров заказа: по типу (явно), внутри — по группе/материалу (менее явно)
            const itemsByType = Object.keys(PRODUCT_TYPE_LABELS_PLURAL)
              .map((type) => {
                const typeItems = sortedItems.filter(
                  (item) => item.product.type === type,
                );
                if (typeItems.length === 0) return null;

                const byGroup = new Map<
                  string,
                  {
                    key: string;
                    name: string | null;
                    items: typeof typeItems;
                    qty: number;
                    sum: number;
                  }
                >();
                typeItems.forEach((item) => {
                  const groupId = item.product.groupId;
                  const key = String(groupId ?? 'none');
                  if (!byGroup.has(key)) {
                    const group = groups.find((g) => g.id === groupId);
                    byGroup.set(key, {
                      key,
                      name: groupId
                        ? (group?.translations as any)?.ru ||
                          group?.slug ||
                          null
                        : null,
                      items: [],
                      qty: 0,
                      sum: 0,
                    });
                  }
                  const bucket = byGroup.get(key)!;
                  bucket.items.push(item);
                  bucket.qty += item.quantity;
                  bucket.sum += Number(item.sum) + Number(item.vatAmount);
                });

                const sortedGroups = Array.from(byGroup.values()).sort(
                  (a, b) => {
                    if (a.name === null) return 1;
                    if (b.name === null) return -1;
                    return a.name.localeCompare(b.name, 'ru');
                  },
                );

                return {
                  type,
                  qty: typeItems.reduce((s, item) => s + item.quantity, 0),
                  sum: typeItems.reduce(
                    (s, item) =>
                      s + Number(item.sum) + Number(item.vatAmount),
                    0,
                  ),
                  groups: sortedGroups,
                };
              })
              .filter((t): t is NonNullable<typeof t> => t !== null);

            const creator = order.createdBy;
            const creatorLabel = !creator
              ? null
              : creator.role === 'PARTNER'
                ? `Оформлено партнёром`
                : `Оформлено ${
                    creator.role === 'SUPER_ADMIN' ? 'супер админом' : 'админом'
                  }: ${creator.name}`;
            const isTestOrder = isTestPartnerName(order.partner.name);

            return (
              <Card
                key={order.id}
                className={cn(
                  'py-1 cursor-pointer hover:bg-secondary/50 transition-colors',
                  mergeMode && !mergeEligible && 'opacity-50',
                  isTestOrder &&
                    'border-dashed border-amber-500/60 bg-amber-500/5 dark:bg-amber-500/10',
                )}
                onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
              >
                <CardContent>
                  <div className="flex items-center justify-between gap-4">
                    {mergeMode && (
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border-input accent-primary"
                        checked={selectedMergeIds.includes(order.id)}
                        disabled={!mergeEligible}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => handleToggleMergeSelect(order.id)}
                        title={
                          mergeEligible
                            ? undefined
                            : 'Нельзя выбрать: другой партнёр, заказ на реализацию, оплачен или отменён'
                        }
                      />
                    )}
                    {/* Левая часть: номер, партнер, дата */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">
                          Заказ #{order.id}
                          {order.isMerged && ' (объединено)'}
                        </span>
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
                        {order.hasVat && (
                          <Badge className="bg-transparent border border-blue-400 text-xs text-blue-400">
                            с НДС
                          </Badge>
                        )}
                        {hasMarginIssue && (
                          <Badge
                            className="gap-1 bg-red-500/15 text-xs text-red-600 dark:text-red-400"
                            title="Есть товары с ценой ниже себестоимости"
                          >
                            <TriangleAlert size={11} />
                            Ниже себестоимости
                          </Badge>
                        )}
                        {isTestOrder && (
                          <Badge
                            className="gap-1 border border-dashed border-amber-500 bg-amber-500/15 text-xs text-amber-600 dark:text-amber-400"
                            title="Партнёр похож на тестового - заказ не учитывается в аналитике"
                          >
                            <FlaskConical size={11} />
                            Тест
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 truncate">
                        {order.partner.name} • {formatDate(order.createdAt)}
                      </p>
                      {creatorLabel && (
                        <p className="text-xs text-muted-foreground truncate">
                          {creatorLabel}
                        </p>
                      )}
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
                          {formatMDL(Number(order.totalPrice))}
                        </p>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-1 space-y-3 border-t pt-3">
                      {/* Partner contact info */}
                      {(order.partner.phone ||
                        order.address ||
                        order.partner.address) && (
                        <div className="bg-secondary p-3 rounded space-y-1">
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Контакты партнёра:
                          </p>
                          {order.partner.phone && (
                            <p className="text-sm flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              {order.partner.phone}
                            </p>
                          )}
                          {(order.address || order.partner.address) && (
                            <p className="text-sm flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              {order.address || order.partner.address}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Order Notes */}
                      <div className="bg-secondary p-3 rounded">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Примечание:
                            </p>
                            <p className="text-sm wrap-break-word">
                              {order.notes || (
                                <span className="text-muted-foreground italic">
                                  Нет примечания
                                </span>
                              )}
                            </p>
                          </div>
                          {canManage && (
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
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium mb-2">Товары:</h4>
                        <div className="overflow-x-auto rounded-md border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-secondary/60 text-xs text-muted-foreground">
                                <th className="py-1.5 px-2 text-left font-medium">
                                  Артикул
                                </th>
                                <th className="py-1.5 px-2 text-right font-medium">
                                  Кол-во
                                </th>
                                <th className="py-1.5 px-2 text-right font-medium">
                                  Цена/шт
                                </th>
                                <th className="py-1.5 px-2 text-right font-medium">
                                  Сумма
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {itemsByType.map((typeBucket) => (
                                <Fragment key={typeBucket.type}>
                                  {/* Заголовок типа — явно */}
                                  <tr className="bg-secondary/40">
                                    <td colSpan={4} className="px-2 py-1.5">
                                      <div className="flex items-baseline justify-between gap-2">
                                        <span className="text-sm font-semibold">
                                          {PRODUCT_TYPE_LABELS_PLURAL[
                                            typeBucket.type
                                          ] || typeBucket.type}
                                        </span>
                                        <span className="text-xs font-medium text-muted-foreground">
                                          {typeBucket.qty} шт •{' '}
                                          {formatMDL(typeBucket.sum)}
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                  {typeBucket.groups.map((group) => (
                                    <Fragment key={group.key}>
                                      {/* Заголовок группы/материала — менее явно */}
                                      {group.name && (
                                        <tr>
                                          <td
                                            colSpan={4}
                                            className="px-2 pt-1.5 pb-0.5 pl-4"
                                          >
                                            <div className="flex items-baseline justify-between gap-2">
                                              <span className="text-xs font-medium text-muted-foreground">
                                                {group.name}
                                              </span>
                                              <span className="text-[11px] text-muted-foreground/70">
                                                {group.qty} шт •{' '}
                                                {formatMDL(group.sum)}
                                              </span>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                      {group.items.map((item) => {
                                        const belowCost =
                                          Number(item.pricePerItem) <
                                          Number(item.product.costPrice);
                                        return (
                                          <tr
                                            key={item.id}
                                            className={cn(
                                              'border-b border-border/50 last:border-0',
                                              belowCost &&
                                                'text-red-600 dark:text-red-400',
                                            )}
                                            title={
                                              belowCost
                                                ? `Цена ${formatMDL(Number(item.pricePerItem))} ниже себестоимости ${formatMDL(Number(item.product.costPrice))}`
                                                : undefined
                                            }
                                          >
                                            <td
                                              className={cn(
                                                'py-1 px-2',
                                                group.name ? 'pl-6' : 'pl-4',
                                              )}
                                            >
                                              <span className="inline-flex items-center gap-1">
                                                {belowCost && (
                                                  <TriangleAlert
                                                    size={11}
                                                    className="shrink-0"
                                                  />
                                                )}
                                                {item.product.number}
                                              </span>
                                            </td>
                                            <td className="py-1 px-2 text-right">
                                              {item.quantity}
                                            </td>
                                            <td className="py-1 px-2 text-right text-muted-foreground">
                                              {formatMoney(
                                                Number(item.pricePerItem),
                                              )}
                                            </td>
                                            <td className="py-1 px-2 text-right font-medium">
                                              {formatMDL(
                                                Number(item.sum) +
                                                  Number(item.vatAmount),
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </Fragment>
                                  ))}
                                </Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {order.hasVat && (
                          <div className="text-xs text-muted-foreground mt-2 pt-2 border-t space-y-0.5">
                            <div className="flex justify-between">
                              <span>Без НДС:</span>
                              <span>
                                {formatMDL(
                                  Number(order.totalPrice) -
                                    Number(order.vatAmount),
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>НДС (20%):</span>
                              <span>{formatMDL(Number(order.vatAmount))}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {order.changeLogs.length > 0 && (
                        <div className="space-y-1.5">
                          <h4 className="flex items-center gap-1.5 text-sm font-medium">
                            <History className="h-3.5 w-3.5" />
                            История изменений
                          </h4>
                          {order.changeLogs.map((entry) => (
                            <p
                              key={entry.id}
                              className="text-xs text-muted-foreground wrap-break-word"
                            >
                              {formatDate(entry.createdAt)} —{' '}
                              {entry.changedBy
                                ? `${
                                    entry.changedBy.role === 'PARTNER'
                                      ? 'партнёр'
                                      : entry.changedBy.role === 'SUPER_ADMIN'
                                        ? 'супер админ'
                                        : 'админ'
                                  } ${entry.changedBy.name}`
                                : 'неизвестно'}
                              : {entry.summary}
                            </p>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-1 border-t">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Общая сумма:
                          </p>
                          <p className="text-xl font-bold">
                            {formatMDL(Number(order.totalPrice))}
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                          {/* Кнопка редактирования позиций заказа */}
                          {canManage &&
                            !(order as any).isRealization &&
                            (order.status === 'NEW' ||
                              order.status === 'CONFIRMED') && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full sm:w-auto"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingItemsOrderId(order.id);
                                }}
                                title="Редактировать товары в заказе"
                              >
                                <Pencil className="h-4 w-4 sm:mr-0 mr-2" />
                                <span className="sm:hidden">Товары</span>
                              </Button>
                            )}

                          {/* Кнопка редактирования цен */}
                          {canManage && (
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
                          )}

                          {canManage &&
                            ((order as any).isRealization &&
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
                            ))}

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
                          {canManage && order.status === 'CANCELLED' && (
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
        {visibleOrders.length > loadedOrdersCount && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => setLoadedOrdersCount((prev) => prev + 20)}
            >
              Показать больше
            </Button>
          </div>
        )}
      </div>

      {/* Create Order Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-1rem)] lg:max-w-[calc(75vw-2rem)] h-[85vh] flex flex-col overflow-hidden p-6">
          <DialogHeader>
            <DialogTitle>Создать новый заказ</DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] flex-1 min-h-0">
            {/* Left side - Form fields */}
            <div className="space-y-4 min-w-0 overflow-y-auto pr-1">
              {/* Partner Selection */}
              <div>
                <Label htmlFor="partner-search" className="mb-2">
                  Партнёр
                </Label>
                <div ref={partnerComboboxRef} className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between gap-2"
                    onClick={handleOpenPartnerCombobox}
                  >
                    <span className="truncate text-left">
                      {selectedPartnerName}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                  </Button>

                  {isPartnerComboboxOpen && (
                    <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-md border bg-popover p-2 shadow-md">
                      <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <Input
                          value={partnerSearchQuery}
                          onChange={(e) =>
                            setPartnerSearchQuery(e.target.value)
                          }
                          placeholder="Поиск партнёра..."
                          className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
                          autoFocus
                        />
                      </div>

                      <div className="mt-2 max-h-72 overflow-y-auto">
                        {filteredPartners.length === 0 ? (
                          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                            Партнёры не найдены
                          </div>
                        ) : (
                          filteredPartners.map((partner) => {
                            const isSelected =
                              partner.id.toString() === selectedPartnerId;

                            return (
                              <button
                                key={partner.id}
                                type="button"
                                className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                onClick={() =>
                                  handleSelectPartner(partner.id.toString())
                                }
                              >
                                <span className="truncate">{partner.name}</span>
                                {isSelected && (
                                  <Check className="h-4 w-4 shrink-0" />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {selectedPartner?.phone && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3 shrink-0" />
                    {selectedPartner.phone}
                  </p>
                )}
                {lastPartnerOrder && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-2 w-full gap-2"
                    onClick={handleLoadLastOrder}
                  >
                    <History className="h-4 w-4 shrink-0" />
                    Повторить заказ №{lastPartnerOrder.id} от{' '}
                    {formatDate(lastPartnerOrder.createdAt)}
                  </Button>
                )}
              </div>

              {/* Order Type - реализация доступна только супер-админу */}
              {canManage && (
                <div>
                  <Label htmlFor="order-type" className="mb-1">
                    Тип заказа
                  </Label>
                  <Select
                    value={orderType}
                    onValueChange={(v) => {
                      const nextType = v as 'regular' | 'realization';
                      setOrderType(nextType);
                      // НДС применим только к обычным заказам
                      if (nextType === 'realization') {
                        setOrderHasVat(false);
                      }
                    }}
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
              )}

              {/* VAT checkbox - только для обычных заказов */}
              {orderType === 'regular' && (
                <label
                  htmlFor="order-has-vat"
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    id="order-has-vat"
                    type="checkbox"
                    className="h-4 w-4 shrink-0 rounded border-input accent-primary"
                    checked={orderHasVat}
                    onChange={(e) => setOrderHasVat(e.target.checked)}
                  />
                  Заказ с НДС (+20% к каждой позиции)
                </label>
              )}

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

              {/* Address */}
              <div>
                <Label htmlFor="order-address" className="mb-1">
                  Адрес доставки (необязательно)
                </Label>
                <Input
                  id="order-address"
                  type="text"
                  placeholder="Адрес доставки или самовывоза..."
                  value={orderAddress}
                  onChange={(e) => setOrderAddress(e.target.value)}
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
                  <div className="space-y-3">
                    {PRODUCT_TYPES.map((type) => {
                      const typeData = totalsByType[type];
                      if (!typeData || typeData.count === 0) return null;
                      const groupEntries = Object.values(typeData.byGroup).sort(
                        (a, b) => a.groupName.localeCompare(b.groupName, 'ru'),
                      );
                      return (
                        <div key={type}>
                          <div className="flex justify-between text-sm font-semibold">
                            <span>{PRODUCT_TYPE_LABELS_PLURAL[type]}:</span>
                            <span>
                              {typeData.count} шт •{' '}
                              {formatMDL(typeData.sum)}
                            </span>
                          </div>
                          {groupEntries.length > 1 && (
                            <div className="pl-4 mt-1 space-y-1">
                              {groupEntries.map((g) => (
                                <div
                                  key={g.groupId ?? 'none'}
                                  className="flex justify-between text-xs text-muted-foreground"
                                >
                                  <span>{g.groupName}:</span>
                                  <span>
                                    {g.count} шт ×{' '}
                                    {formatMDL(g.sum / g.count)} •{' '}
                                    {formatMDL(g.sum)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
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
                        {formatMDL(totalSum)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right side - Filters, Products grid and totals */}
            <div className="space-y-4 min-w-0 flex flex-col min-h-0">
              {/* Filters */}
              <div className="flex flex-wrap gap-3 shrink-0">
                {/* Product Search */}
                <div className="max-w-70 flex-1">
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
                <div className="max-w-fit flex-1">
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
                <div className="max-w-fit flex-1">
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
              <div className="border rounded-lg p-4 flex-1 min-h-0 overflow-y-auto">
                <h4 className="font-semibold mb-3">
                  Товары ({filteredProducts.length})
                </h4>
                {filteredProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Товары не найдены
                  </p>
                ) : (
                  <div className="columns-2 sm:columns-3 xl:columns-4 gap-2">
                    {filteredProducts.map((product, index) => (
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
                          onKeyDown={(e) => handleQuantityKeyDown(e, index)}
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
          <div className="flex justify-end gap-2 pt-4 border-t shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setOrderType('regular');
                setOrderHasVat(false);
                setOrderNotes('');
                setOrderAddress('');
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
              {creating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Создание...
                </>
              ) : (
                'Создать заказ'
              )}
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
                {updatingNotes ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  'Сохранить'
                )}
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

      {/* Edit Order Items Dialog */}
      {editingItemsOrderId !== null && (
        <EditOrderDialog
          orderId={editingItemsOrderId}
          open={editingItemsOrderId !== null}
          onOpenChange={(open) => {
            if (!open) setEditingItemsOrderId(null);
          }}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}

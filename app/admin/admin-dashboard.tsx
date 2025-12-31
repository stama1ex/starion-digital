'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import SalesAnalytics from './sections/sales-analytics';
import TopProducts from './sections/top-products';
import DealerAnalytics from './sections/dealer-analytics';
import DebtTracking from './sections/debt-tracking';
import RealizationTracking from './sections/realization-tracking';
import OrdersManagement from './sections/orders-management';
import PartnersManagement from './sections/partners-management';
import PricesManagement from './sections/prices-management';
import ProductsManagement from './sections/products-management';
import { GroupsManagement } from './sections/groups-management';
import AdminSettings from './sections/admin-settings';
import type { AdminOrder, AdminPartner, AdminRealization } from './types';
import type { DateRange } from './utils';
import { ProductGroup } from '@prisma/client';

interface AdminDashboardProps {
  orders: AdminOrder[];
  partners: AdminPartner[];
  realizations: AdminRealization[];
  groups: ProductGroup[];
}

export default function AdminDashboard({
  orders: initialOrders,
  partners,
  realizations: initialRealizations,
  groups,
}: AdminDashboardProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [realizations, setRealizations] = useState(initialRealizations);
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [customDateRange, setCustomDateRange] = useState<{
    from: string;
    to: string;
  }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [activeTab, setActiveTab] = useState('orders');
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Подсчет новых заказов
  useEffect(() => {
    const count = orders.filter((order) => order.status === 'NEW').length;
    setNewOrdersCount(count);
  }, [orders]);

  // Загрузка количества pending заявок
  useEffect(() => {
    const fetchPendingRequests = async () => {
      try {
        const res = await fetch('/api/admin/partnership-requests');
        if (res.ok) {
          const data = await res.json();
          const pendingCount = data.filter(
            (req: { status: string }) => req.status === 'PENDING'
          ).length;
          setPendingRequestsCount(pendingCount);
        }
      } catch (error) {
        console.error('Error fetching pending requests:', error);
      }
    };
    fetchPendingRequests();
  }, []);

  const handleRefreshOrders = async () => {
    try {
      // Загружаем свежие данные без перезагрузки страницы
      const [ordersRes, realizationsRes] = await Promise.all([
        fetch('/api/admin/orders'),
        fetch('/api/admin/realizations'),
      ]);

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData.orders || []);
      }

      if (realizationsRes.ok) {
        const realizationsData = await realizationsRes.json();
        setRealizations(realizationsData.realizations || []);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
      // Fallback: перезагружаем страницу
      window.location.reload();
    }
  };

  const handleRefreshPendingRequests = async () => {
    try {
      const res = await fetch('/api/admin/partnership-requests');
      if (res.ok) {
        const data = await res.json();
        const pendingCount = data.filter(
          (req: { status: string }) => req.status === 'PENDING'
        ).length;
        setPendingRequestsCount(pendingCount);
      }
    } catch (error) {
      console.error('Error refreshing pending requests:', error);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-0">
      <Tabs
        defaultValue="orders"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 gap-1 h-auto">
          <TabsTrigger
            value="orders"
            className="text-xs sm:text-sm py-2 relative"
          >
            <span className="hidden sm:inline">📋 </span>Заказы
            {newOrdersCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-1 h-5 min-w-5 px-1 text-xs"
              >
                {newOrdersCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm py-2">
            <span className="hidden sm:inline">📊 </span>Анализ
          </TabsTrigger>
          <TabsTrigger
            value="edit"
            className="text-xs sm:text-sm py-2 relative"
          >
            <span className="hidden sm:inline">⚙️ </span>Настройки
            {pendingRequestsCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-1 h-5 min-w-5 px-1 text-xs"
              >
                {pendingRequestsCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Управление заказами */}
        <TabsContent value="orders" className="space-y-4">
          <Tabs defaultValue="orders-list" className="w-full">
            <TabsList className="grid w-full grid-cols-2 gap-1">
              <TabsTrigger
                value="orders-list"
                className="text-xs sm:text-sm relative"
              >
                Заказы
                {newOrdersCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-1 h-5 min-w-5 px-1 text-xs"
                  >
                    {newOrdersCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="realization" className="text-xs sm:text-sm">
                Реализ.
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders-list">
              <OrdersManagement
                orders={orders}
                onRefresh={handleRefreshOrders}
                groups={groups}
              />
            </TabsContent>

            <TabsContent value="realization">
              <RealizationTracking
                realizations={realizations}
                onRefresh={handleRefreshOrders}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Анализ */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setDateRange('day');
                  setUseCustomRange(false);
                }}
                className={`px-3 py-2 text-sm rounded cursor-pointer ${
                  !useCustomRange && dateRange === 'day'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground'
                }`}
              >
                День
              </button>
              <button
                onClick={() => {
                  setDateRange('week');
                  setUseCustomRange(false);
                }}
                className={`px-3 py-2 text-sm rounded cursor-pointer ${
                  !useCustomRange && dateRange === 'week'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground'
                }`}
              >
                Неделя
              </button>
              <button
                onClick={() => {
                  setDateRange('month');
                  setUseCustomRange(false);
                }}
                className={`px-3 py-2 text-sm rounded cursor-pointer ${
                  !useCustomRange && dateRange === 'month'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground'
                }`}
              >
                Месяц
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              <label className="text-sm font-medium whitespace-nowrap">
                Промежуток:
              </label>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">
                    От:
                  </label>
                  <input
                    type="date"
                    value={customDateRange.from}
                    onChange={(e) => {
                      setCustomDateRange({
                        ...customDateRange,
                        from: e.target.value,
                      });
                      setUseCustomRange(true);
                    }}
                    className="px-3 py-2 border rounded bg-background text-foreground text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">
                    До:
                  </label>
                  <input
                    type="date"
                    value={customDateRange.to}
                    onChange={(e) => {
                      setCustomDateRange({
                        ...customDateRange,
                        to: e.target.value,
                      });
                      setUseCustomRange(true);
                    }}
                    className="px-3 py-2 border rounded bg-background text-foreground text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <Tabs defaultValue="sales" className="w-full">
            <TabsList className="grid w-full grid-cols-4 gap-1">
              <TabsTrigger value="sales" className="text-xs sm:text-sm">
                Продажи
              </TabsTrigger>
              <TabsTrigger value="products" className="text-xs sm:text-sm">
                ТОП товары
              </TabsTrigger>
              <TabsTrigger value="dealers" className="text-xs sm:text-sm">
                Дилеры
              </TabsTrigger>
              <TabsTrigger value="debt" className="text-xs sm:text-sm">
                Долги
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sales">
              <SalesAnalytics
                orders={orders}
                realizations={realizations}
                partners={partners}
                dateRange={dateRange}
                customDateRange={useCustomRange ? customDateRange : null}
              />
            </TabsContent>

            <TabsContent value="products">
              <TopProducts
                orders={orders}
                realizations={realizations}
                dateRange={dateRange}
                customDateRange={useCustomRange ? customDateRange : null}
              />
            </TabsContent>

            <TabsContent value="dealers">
              <DealerAnalytics
                orders={orders}
                realizations={realizations}
                dateRange={dateRange}
                customDateRange={useCustomRange ? customDateRange : null}
              />
            </TabsContent>

            <TabsContent value="debt">
              <DebtTracking
                orders={orders}
                realizations={realizations}
                partners={partners}
                dateRange={dateRange}
                customDateRange={useCustomRange ? customDateRange : null}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Редактировать */}
        <TabsContent value="edit" className="space-y-4">
          <Tabs defaultValue="partners" className="w-full">
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 gap-1">
              <TabsTrigger
                value="partners"
                className="text-xs sm:text-sm relative"
              >
                Партнеры
                {pendingRequestsCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-1 h-5 min-w-5 px-1 text-xs"
                  >
                    {pendingRequestsCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="prices" className="text-xs sm:text-sm">
                Цены
              </TabsTrigger>
              <TabsTrigger value="catalog" className="text-xs sm:text-sm">
                Товары
              </TabsTrigger>
              <TabsTrigger value="groups" className="text-xs sm:text-sm">
                Группы
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-xs sm:text-sm">
                Админ-данные
              </TabsTrigger>
            </TabsList>

            <TabsContent value="partners">
              <PartnersManagement
                onRequestsChange={handleRefreshPendingRequests}
                pendingRequestsCount={pendingRequestsCount}
              />
            </TabsContent>

            <TabsContent value="prices">
              <PricesManagement />
            </TabsContent>

            <TabsContent value="catalog">
              <ProductsManagement />
            </TabsContent>

            <TabsContent value="groups">
              <GroupsManagement />
            </TabsContent>

            <TabsContent value="settings">
              <AdminSettings />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}

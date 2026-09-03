'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Download, Loader2, DatabaseBackup } from 'lucide-react';
import SalesAnalytics from './sections/sales-analytics';
import TopProducts from './sections/top-products';
import DealerAnalytics from './sections/dealer-analytics';
import DebtTracking from './sections/debt-tracking';
import RealizationTracking from './sections/realization-tracking';
import OrdersManagement from './sections/orders-management';
import OrdersTrash from './sections/orders-trash';
import PartnersManagement from './sections/partners-management';
import PricesManagement from './sections/prices-management';
import ProductsManagement from './sections/products-management';
import { GroupsManagement } from './sections/groups-management';
import type { AdminOrder, AdminPartner, AdminRealization } from './types';
import type { DateRange } from './utils';
import { ProductGroup, PartnerRole } from '@prisma/client';
import { isTestPartnerName } from '@/lib/admin';

// AR-раздел ленивый: тянет qrcode и клиентский AR-код только когда открыта
// вкладка, не раздувая основной чанк админки.
const ARManagement = dynamic(() => import('./sections/ar-management'), {
  ssr: false,
  loading: () => <div className="p-4">Загрузка...</div>,
});

interface AdminDashboardProps {
  orders: AdminOrder[];
  partners: AdminPartner[];
  realizations: AdminRealization[];
  groups: ProductGroup[];
  role: PartnerRole;
}

export default function AdminDashboard({
  orders: initialOrders,
  partners,
  realizations: initialRealizations,
  groups,
  role,
}: AdminDashboardProps) {
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isProductAdmin = role === 'PRODUCT_ADMIN';
  // Заказы доступны только этим двум ролям - ограниченному "ADMIN" и
  // супер-админу; у PRODUCT_ADMIN (и будущих неорденных ролей) их нет
  const canViewOrders = isSuperAdmin || role === 'ADMIN';
  const [orders, setOrders] = useState(initialOrders);
  const [realizations, setRealizations] = useState(initialRealizations);
  const [dateRange, setDateRange] = useState<DateRange>('all');
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
  const [analyticsSubTab, setAnalyticsSubTab] = useState('sales');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState('orders');
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [exportingDb, setExportingDb] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);

  const handleRunBackup = async () => {
    setRunningBackup(true);
    try {
      const response = await fetch('/api/cron/backup');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка резервного копирования');
      }

      const totalRows = Object.values(
        data.manifest as Record<string, number>,
      ).reduce((sum, count) => sum + count, 0);
      toast.success(
        `Резервная копия сохранена в Dropbox (${totalRows} записей)`,
      );
    } catch (error) {
      console.error('Error running backup:', error);
      const message =
        error instanceof Error ? error.message : 'Неизвестная ошибка';
      toast.error(`Не удалось создать резервную копию: ${message}`);
    } finally {
      setRunningBackup(false);
    }
  };

  const handleExportDb = async () => {
    setExportingDb(true);
    try {
      const response = await fetch('/api/admin/export-db');

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Ошибка экспорта');
        }
        throw new Error(`Ошибка сервера: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().split('T')[0];
      a.download = `starion-db-export-${date}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting database:', error);
      const message =
        error instanceof Error ? error.message : 'Неизвестная ошибка';
      toast.error(`Не удалось экспортировать базу данных: ${message}`);
    } finally {
      setExportingDb(false);
    }
  };

  // Подсчет новых заказов
  useEffect(() => {
    const count = orders.filter((order) => order.status === 'NEW').length;
    setNewOrdersCount(count);
  }, [orders]);

  // Тестовые партнёры и их заказы/реализации исключаются из вкладки "Анализ" -
  // их фиктивные суммы не должны искажать выручку, топ товаров, дилеров и долги.
  // На вкладке "Заказы" они по-прежнему видны (с отдельной пометкой).
  const analyticsPartners = partners.filter(
    (partner) => !isTestPartnerName(partner.name),
  );
  const analyticsOrders = orders.filter(
    (order) => !isTestPartnerName(order.partner.name),
  );
  const analyticsRealizations = realizations.filter(
    (realization) => !isTestPartnerName(realization.partner.name),
  );

  const analyticsPartnerOptions = analyticsPartners.map((partner) => ({
    value: partner.id.toString(),
    label: partner.name,
  }));

  // Загрузка количества pending заявок - недоступно ограниченному админу
  useEffect(() => {
    if (!isSuperAdmin) return;

    const fetchPendingRequests = async () => {
      try {
        const res = await fetch('/api/admin/partnership-requests');
        if (res.ok) {
          const data = await res.json();
          const pendingCount = data.filter(
            (req: { status: string }) => req.status === 'PENDING',
          ).length;
          setPendingRequestsCount(pendingCount);
        }
      } catch (error) {
        console.error('Error fetching pending requests:', error);
      }
    };
    fetchPendingRequests();
  }, [isSuperAdmin]);

  const handleRefreshOrders = useCallback(async () => {
    // Админу по товарам (и будущим неорденным ролям) заказы недоступны -
    // эндпоинты вернут 401, не тратим запрос впустую.
    if (!canViewOrders) return;

    try {
      // Загружаем свежие данные без перезагрузки страницы. Реализации
      // недоступны ограниченному админу - не тратим запрос впустую.
      const [ordersRes, realizationsRes] = await Promise.all([
        fetch('/api/admin/orders'),
        isSuperAdmin ? fetch('/api/admin/realizations') : Promise.resolve(null),
      ]);

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData.orders || []);
      }

      if (realizationsRes?.ok) {
        const realizationsData = await realizationsRes.json();
        setRealizations(realizationsData.realizations || []);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
      // Не перезагружаем страницу целиком - это стирало бы любые открытые
      // диалоги/несохранённый ввод в других местах интерфейса из-за
      // разового сетевого сбоя. Оставляем уже загруженные данные как есть,
      // следующий поллинг/действие само повторит попытку.
      toast.error(
        'Не удалось обновить данные - проверьте соединение с интернетом',
      );
    }
  }, [canViewOrders, isSuperAdmin]);

  // Поллинг новых заказов: лёгкий запрос раз в 20 секунд вместо ручного
  // обновления страницы — если появился новый заказ, подтягиваем полный
  // список автоматически.
  const lastSeenOrderIdRef = useRef<number | null>(
    initialOrders[0]?.id ?? null,
  );

  useEffect(() => {
    if (!canViewOrders) return;

    const checkForNewOrders = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch('/api/admin/orders/check-new');
        if (!res.ok) return;
        const data: { latestId: number | null } = await res.json();

        if (
          data.latestId !== null &&
          data.latestId !== lastSeenOrderIdRef.current
        ) {
          const isFirstCheck = lastSeenOrderIdRef.current === null;
          lastSeenOrderIdRef.current = data.latestId;
          await handleRefreshOrders();
          if (!isFirstCheck) {
            toast.success('Новый заказ');
          }
        }
      } catch (error) {
        console.error('Error polling for new orders:', error);
      }
    };

    const interval = setInterval(checkForNewOrders, 20000);
    return () => clearInterval(interval);
  }, [canViewOrders, handleRefreshOrders]);

  const handleRefreshPendingRequests = async () => {
    try {
      const res = await fetch('/api/admin/partnership-requests');
      if (res.ok) {
        const data = await res.json();
        const pendingCount = data.filter(
          (req: { status: string }) => req.status === 'PENDING',
        ).length;
        setPendingRequestsCount(pendingCount);
      }
    } catch (error) {
      console.error('Error refreshing pending requests:', error);
    }
  };

  // Админ по товарам видит только разделы "Товары" и "Группы"
  if (isProductAdmin) {
    return (
      <div className="space-y-6 p-4 md:p-0">
        <Tabs defaultValue="catalog" className="w-full">
          <TabsList className="grid w-full grid-cols-2 gap-1 h-auto">
            <TabsTrigger value="catalog" className="text-xs sm:text-sm py-2">
              <span className="hidden sm:inline">🛍️ </span>Товары
            </TabsTrigger>
            <TabsTrigger value="groups" className="text-xs sm:text-sm py-2">
              <span className="hidden sm:inline">🗂️ </span>Группы
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="space-y-4">
            <ProductsManagement />
          </TabsContent>

          <TabsContent value="groups" className="space-y-4">
            <GroupsManagement />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Ограниченный админ видит только страницу "Заказы", без вкладок
  if (!isSuperAdmin) {
    return (
      <div className="space-y-6 p-4 md:p-0">
        <OrdersManagement
          orders={orders}
          onRefresh={handleRefreshOrders}
          groups={groups}
          canManage={false}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-0">
      <div className="fixed bottom-0 right-4 z-50 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRunBackup}
          disabled={runningBackup}
          className="shadow-lg bg-background"
          title="Сохранить резервную копию всех данных в Dropbox прямо сейчас (помимо ежедневного автоматического бэкапа)"
        >
          {runningBackup ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <DatabaseBackup className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {runningBackup ? 'Бэкап...' : 'Бэкап сейчас'}
          </span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportDb}
          disabled={exportingDb}
          className="shadow-lg bg-background"
          title="Экспортировать все бизнес-данные в CSV (архивом)"
        >
          {exportingDb ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {exportingDb ? 'Экспорт...' : 'Экспорт БД (CSV)'}
          </span>
        </Button>
      </div>

      <Tabs
        defaultValue="orders"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-4 gap-1 h-auto">
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
            <span className="hidden sm:inline">⚙️ </span>Управление
            {pendingRequestsCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-1 h-5 min-w-5 px-1 text-xs"
              >
                {pendingRequestsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ar" className="text-xs sm:text-sm py-2">
            <span className="hidden sm:inline">🔮 </span>AR
          </TabsTrigger>
        </TabsList>

        {/* Управление заказами */}
        <TabsContent value="orders" className="space-y-4">
          <Tabs defaultValue="orders-list" className="w-full">
            <TabsList className="grid w-full grid-cols-3 gap-1">
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
              <TabsTrigger value="trash" className="text-xs sm:text-sm">
                Корзина
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders-list">
              <OrdersManagement
                orders={orders}
                onRefresh={handleRefreshOrders}
                groups={groups}
                canManage={true}
              />
            </TabsContent>

            <TabsContent value="realization">
              <RealizationTracking
                realizations={realizations}
                onRefresh={handleRefreshOrders}
              />
            </TabsContent>

            <TabsContent value="trash">
              <OrdersTrash onRestored={handleRefreshOrders} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Анализ */}
        <TabsContent value="analytics" className="space-y-4">
          <Tabs
            value={analyticsSubTab}
            onValueChange={setAnalyticsSubTab}
            className="w-full space-y-4"
          >
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

            {/* Долги — это баланс "на сейчас" и не зависит от периода, поэтому
                фильтр по времени для этой вкладки не нужен и не показывается. */}
            {analyticsSubTab !== 'debt' && (
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
                  <button
                    onClick={() => {
                      setDateRange('all');
                      setUseCustomRange(false);
                    }}
                    className={`px-3 py-2 text-sm rounded cursor-pointer ${
                      !useCustomRange && dateRange === 'all'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground'
                    }`}
                  >
                    За все время
                  </button>
                </div>

                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
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

                  {analyticsSubTab === 'sales' && (
                    <Combobox
                      className="w-full lg:w-auto"
                      triggerClassName="lg:w-56"
                      options={analyticsPartnerOptions}
                      value={selectedPartnerId}
                      onChange={setSelectedPartnerId}
                      placeholder="Все партнеры"
                      searchPlaceholder="Поиск партнера..."
                      emptyText="Партнер не найден"
                      clearable
                      onClear={() => setSelectedPartnerId('ALL')}
                    />
                  )}
                </div>
              </div>
            )}

            <TabsContent value="sales">
              <SalesAnalytics
                orders={analyticsOrders}
                realizations={analyticsRealizations}
                selectedPartnerId={selectedPartnerId}
                dateRange={dateRange}
                customDateRange={useCustomRange ? customDateRange : null}
              />
            </TabsContent>

            <TabsContent value="products">
              <TopProducts
                orders={analyticsOrders}
                realizations={analyticsRealizations}
                dateRange={dateRange}
                customDateRange={useCustomRange ? customDateRange : null}
              />
            </TabsContent>

            <TabsContent value="dealers">
              <DealerAnalytics
                orders={analyticsOrders}
                realizations={analyticsRealizations}
                dateRange={dateRange}
                customDateRange={useCustomRange ? customDateRange : null}
              />
            </TabsContent>

            <TabsContent value="debt">
              <DebtTracking
                orders={analyticsOrders}
                realizations={analyticsRealizations}
                partners={analyticsPartners}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Редактировать */}
        <TabsContent value="edit" className="space-y-4">
          <Tabs defaultValue="partners" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-1">
              <TabsTrigger
                value="partners"
                className="text-xs sm:text-sm relative"
              >
                Партнёры и админы
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
          </Tabs>
        </TabsContent>

        {/* AR — Оживление сувениров */}
        <TabsContent value="ar" className="space-y-4">
          <ARManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}

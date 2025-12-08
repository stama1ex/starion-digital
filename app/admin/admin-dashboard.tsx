'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SalesAnalytics from './sections/sales-analytics';
import TopProducts from './sections/top-products';
import DealerAnalytics from './sections/dealer-analytics';
import DebtTracking from './sections/debt-tracking';
import RealizationTracking from './sections/realization-tracking';
import PartnersManagement from './sections/partners-management';
import PricesManagement from './sections/prices-management';
import ProductsManagement from './sections/products-management';
import MaterialsManagement from './sections/materials-management';
import type { AdminOrder, AdminPartner, AdminRealization } from './types';
import type { DateRange } from './utils';

interface AdminDashboardProps {
  orders: AdminOrder[];
  partners: AdminPartner[];
  realizations: AdminRealization[];
}

export default function AdminDashboard({
  orders,
  partners,
  realizations,
}: AdminDashboardProps) {
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

  return (
    <div className="space-y-6 p-4 md:p-0">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setDateRange('day');
              setUseCustomRange(false);
            }}
            className={`px-3 py-2 text-sm rounded ${
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
            className={`px-3 py-2 text-sm rounded ${
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
            className={`px-3 py-2 text-sm rounded ${
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1 h-auto">
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
          <TabsTrigger value="realization" className="text-xs sm:text-sm">
            Реализ.
          </TabsTrigger>
          <TabsTrigger value="partners" className="text-xs sm:text-sm">
            Партнеры
          </TabsTrigger>
          <TabsTrigger value="prices" className="text-xs sm:text-sm">
            Цены
          </TabsTrigger>
          <TabsTrigger value="catalog" className="text-xs sm:text-sm">
            Товары
          </TabsTrigger>
          <TabsTrigger value="materials" className="text-xs sm:text-sm">
            Материалы
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <SalesAnalytics
            orders={orders}
            realizations={realizations}
            dateRange={dateRange}
            customDateRange={useCustomRange ? customDateRange : null}
          />
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <TopProducts
            orders={orders}
            realizations={realizations}
            dateRange={dateRange}
            customDateRange={useCustomRange ? customDateRange : null}
          />
        </TabsContent>

        <TabsContent value="dealers" className="space-y-4">
          <DealerAnalytics
            orders={orders}
            realizations={realizations}
            dateRange={dateRange}
            customDateRange={useCustomRange ? customDateRange : null}
          />
        </TabsContent>

        <TabsContent value="debt" className="space-y-4">
          <DebtTracking
            orders={orders}
            realizations={realizations}
            partners={partners}
            dateRange={dateRange}
            customDateRange={useCustomRange ? customDateRange : null}
          />
        </TabsContent>

        <TabsContent value="realization" className="space-y-4">
          <RealizationTracking realizations={realizations} />
        </TabsContent>

        <TabsContent value="partners" className="space-y-4">
          <PartnersManagement />
        </TabsContent>

        <TabsContent value="prices" className="space-y-4">
          <PricesManagement />
        </TabsContent>

        <TabsContent value="catalog" className="space-y-4">
          <ProductsManagement />
        </TabsContent>

        <TabsContent value="materials" className="space-y-4">
          <MaterialsManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}

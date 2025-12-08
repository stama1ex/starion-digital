'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SalesAnalytics from './sections/sales-analytics';
import TopProducts from './sections/top-products';
import DealerAnalytics from './sections/dealer-analytics';
import DebtTracking from './sections/debt-tracking';
import RealizationTracking from './sections/realization-tracking';
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

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          onClick={() => setDateRange('day')}
          className={`px-4 py-2 rounded ${
            dateRange === 'day'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-foreground'
          }`}
        >
          День
        </button>
        <button
          onClick={() => setDateRange('week')}
          className={`px-4 py-2 rounded ${
            dateRange === 'week'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-foreground'
          }`}
        >
          Неделя
        </button>
        <button
          onClick={() => setDateRange('month')}
          className={`px-4 py-2 rounded ${
            dateRange === 'month'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-foreground'
          }`}
        >
          Месяц
        </button>
      </div>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="sales">Продажи</TabsTrigger>
          <TabsTrigger value="products">ТОП товары</TabsTrigger>
          <TabsTrigger value="dealers">Дилеры</TabsTrigger>
          <TabsTrigger value="debt">Долги</TabsTrigger>
          <TabsTrigger value="realization">Реализация</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <SalesAnalytics orders={orders} dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <TopProducts orders={orders} dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="dealers" className="space-y-4">
          <DealerAnalytics orders={orders} dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="debt" className="space-y-4">
          <DebtTracking
            orders={orders}
            realizations={realizations}
            partners={partners}
            dateRange={dateRange}
          />
        </TabsContent>

        <TabsContent value="realization" className="space-y-4">
          <RealizationTracking realizations={realizations} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { filterByDateRange, calculateMetrics } from '../utils';

interface SalesAnalyticsProps {
  orders: any[];
  dateRange: 'day' | 'week' | 'month';
}

export default function SalesAnalytics({
  orders,
  dateRange,
}: SalesAnalyticsProps) {
  const filteredOrders = filterByDateRange(orders, dateRange);

  // Создаём маппер для себестоимости (потом нужно получать из БД)
  const costPriceMap = new Map<number, number>();

  const metrics = calculateMetrics(filteredOrders, costPriceMap);

  const periodLabel = {
    day: 'Сегодня',
    week: 'На этой неделе',
    month: 'В этом месяце',
  }[dateRange];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Объём продаж {periodLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${metrics.totalRevenue.toFixed(2)} MDL
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {filteredOrders.length} заказов
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Себестоимость {periodLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            ${metrics.totalCost.toFixed(2)} MDL
          </div>
          <p className="text-xs text-muted-foreground mt-2">Всего расходов</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Gross Profit {periodLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              metrics.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            ${metrics.grossProfit.toFixed(2)} MDL
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Маржа:{' '}
            {((metrics.grossProfit / metrics.totalRevenue) * 100).toFixed(1)}%
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

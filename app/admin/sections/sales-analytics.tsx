/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { filterByDateRange, calculateMetrics } from '../utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface SalesAnalyticsProps {
  orders: any[];
  dateRange: 'day' | 'week' | 'month';
  customDateRange?: { from: string; to: string } | null;
}

export default function SalesAnalytics({
  orders,
  dateRange,
  customDateRange,
}: SalesAnalyticsProps) {
  const filteredOrders = filterByDateRange(
    orders,
    dateRange,
    customDateRange || undefined
  );

  // Маппер себестоимости (в дальнейшем можно получать из БД)
  const costPriceMap = new Map<number, number>();
  const metrics = calculateMetrics(filteredOrders, costPriceMap);

  // === Построение данных графика по дням ===
  const dateMap = new Map<
    string,
    { revenue: number; cost: number; profit: number }
  >();

  filteredOrders.forEach((order) => {
    const isoDate = new Date(order.createdAt).toISOString().split('T')[0]; // YYYY-MM-DD

    const existing = dateMap.get(isoDate) || {
      revenue: 0,
      cost: 0,
      profit: 0,
    };

    const orderRevenue = Number(order.totalPrice);
    const orderCost = order.items.reduce((sum: number, item: any) => {
      return sum + Number(item.product.costPrice ?? 0) * item.quantity;
    }, 0);

    existing.revenue += orderRevenue;
    existing.cost += orderCost;
    existing.profit += orderRevenue - orderCost;

    dateMap.set(isoDate, existing);
  });

  // === Сортируем по ISO дате (старые -> новые), потом форматируем ===
  const sortedEntries = Array.from(dateMap.entries()).sort(
    ([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime()
  );

  const chartData = sortedEntries.map(([date, data]) => ({
    date: new Date(date).toLocaleDateString('ru-RU', {
      year: '2-digit',
      month: 'short',
      day: 'numeric',
    }),
    revenue: Math.round(data.revenue),
    cost: Math.round(data.cost),
    profit: Math.round(data.profit),
  }));

  const periodLabel = customDateRange
    ? `с ${customDateRange.from} по ${customDateRange.to}`
    : {
        day: 'Сегодня',
        week: 'На этой неделе',
        month: 'В этом месяце',
      }[dateRange];

  return (
    <div className="space-y-6">
      {/* === KPI блоки === */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Объём продаж {periodLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.totalRevenue.toFixed(0)} MDL
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
            <div className="text-2xl font-bold">
              {metrics.totalCost.toFixed(0)} MDL
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
                metrics.grossProfit >= 0 ? 'text-green-600' : 'text-destructive'
              }`}
            >
              {metrics.grossProfit.toFixed(0)} MDL
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Маржа:{' '}
              {metrics.totalRevenue > 0
                ? ((metrics.grossProfit / metrics.totalRevenue) * 100).toFixed(
                    1
                  )
                : 0}
              %
            </p>
          </CardContent>
        </Card>
      </div>

      {/* === График === */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Динамика продаж</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => `${value} MDL`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  name="Выручка"
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  name="Прибыль"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

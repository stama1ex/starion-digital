'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { filterByDateRange, type DateRange } from '../utils';
import type { AdminOrder } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DealerAnalyticsProps {
  orders: AdminOrder[];
  dateRange: DateRange;
  customDateRange?: { from: string; to: string } | null;
}

export default function DealerAnalytics({
  orders,
  dateRange,
  customDateRange,
}: DealerAnalyticsProps) {
  const filteredOrders = filterByDateRange(
    orders,
    dateRange,
    customDateRange || undefined
  );

  type DealerStat = {
    id: number;
    name: string;
    totalVolume: number;
    orderCount: number;
  };

  const dealerStats = new Map<number, DealerStat>();

  filteredOrders.forEach((order) => {
    const partnerId = order.partnerId;
    const existing =
      dealerStats.get(partnerId) ||
      ({
        id: partnerId,
        name: order.partner.name,
        totalVolume: 0,
        orderCount: 0,
      } as DealerStat);

    existing.totalVolume += Number(order.totalPrice);
    existing.orderCount += 1;

    dealerStats.set(partnerId, existing);
  });

  const dealersByVolume = Array.from(dealerStats.values()).sort(
    (a, b) => b.totalVolume - a.totalVolume
  );

  // Подготовка данных для графика
  const chartData = dealersByVolume.slice(0, 10).map((dealer) => ({
    name: dealer.name,
    volume: Math.round(dealer.totalVolume),
    orders: dealer.orderCount,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ТОП дилеры по объёму закупок</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dealersByVolume.length === 0 ? (
              <p className="text-muted-foreground">
                Нет данных за выбранный период
              </p>
            ) : (
              dealersByVolume.map((dealer, idx) => (
                <div
                  key={dealer.id}
                  className="flex justify-between items-center pb-3 border-b last:border-b-0"
                >
                  <div>
                    <p className="font-medium">
                      {idx + 1}. {dealer.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {dealer.orderCount} заказов
                    </p>
                  </div>
                  <p className="font-bold text-lg">
                    {dealer.totalVolume.toFixed(0)} MDL
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>График объёма по дилерам</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis />
                <Tooltip formatter={(value) => `${value} MDL`} />
                <Legend />
                <Bar dataKey="volume" fill="#3b82f6" name="Объём закупок" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

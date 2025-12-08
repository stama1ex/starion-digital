'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { filterByDateRange, type DateRange } from '../utils';
import type { AdminOrder } from '../types';

interface DealerAnalyticsProps {
  orders: AdminOrder[];
  dateRange: DateRange;
}

export default function DealerAnalytics({
  orders,
  dateRange,
}: DealerAnalyticsProps) {
  const filteredOrders = filterByDateRange(orders, dateRange);

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

  return (
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
                  {dealer.totalVolume.toFixed(2)} MDL
                </p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

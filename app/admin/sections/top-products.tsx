'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { filterByDateRange, type DateRange } from '../utils';
import type { AdminOrder } from '../types';

interface TopProductsProps {
  orders: AdminOrder[];
  dateRange: DateRange;
}

export default function TopProducts({ orders, dateRange }: TopProductsProps) {
  const filteredOrders = filterByDateRange(orders, dateRange);

  type ProductStat = {
    id: number;
    number: string;
    totalSales: number;
    quantity: number;
    profit: number;
  };

  const productStats = new Map<number, ProductStat>();

  filteredOrders.forEach((order) => {
    order.items.forEach((item) => {
      const productId = item.productId;
      const existing =
        productStats.get(productId) ||
        ({
          id: productId,
          number: item.product.number,
          totalSales: 0,
          quantity: 0,
          profit: 0,
        } as ProductStat);

      const sum = Number(item.sum);
      const costPerUnit = Number(item.product.costPrice ?? 0);
      const costTotal = costPerUnit * item.quantity;

      existing.totalSales += sum;
      existing.quantity += item.quantity;
      existing.profit += sum - costTotal;

      productStats.set(productId, existing);
    });
  });

  const stats = Array.from(productStats.values());

  const topByVolume = [...stats]
    .sort((a, b) => b.totalSales - a.totalSales)
    .slice(0, 10);

  const topByProfit = [...stats]
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>ТОП-10 Товаров по Объёму</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topByVolume.length === 0 ? (
              <p className="text-muted-foreground">
                Нет данных за выбранный период
              </p>
            ) : (
              topByVolume.map((product, idx) => (
                <div
                  key={product.id}
                  className="flex justify-between items-center pb-2 border-b last:border-b-0"
                >
                  <div>
                    <p className="font-medium">
                      {idx + 1}. Товар {product.number}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Кол-во: {product.quantity} шт
                    </p>
                  </div>
                  <p className="font-bold">
                    {product.totalSales.toFixed(2)} MDL
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ТОП-10 Товаров по Прибыли</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topByProfit.length === 0 ? (
              <p className="text-muted-foreground">
                Нет данных за выбранный период
              </p>
            ) : (
              topByProfit.map((product, idx) => (
                <div
                  key={product.id}
                  className="flex justify-between items-center pb-2 border-b last:border-b-0"
                >
                  <div>
                    <p className="font-medium">
                      {idx + 1}. Товар {product.number}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Кол-во: {product.quantity} шт
                    </p>
                  </div>
                  <p
                    className={`font-bold ${
                      product.profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {product.profit.toFixed(2)} MDL
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

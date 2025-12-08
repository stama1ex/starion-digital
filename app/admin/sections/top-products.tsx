/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { filterByDateRange } from '../utils';

interface TopProductsProps {
  orders: any[];
  dateRange: 'day' | 'week' | 'month';
}

export default function TopProducts({ orders, dateRange }: TopProductsProps) {
  const filteredOrders = filterByDateRange(orders, dateRange);

  // Группируем по товарам
  const productStats = new Map<
    number,
    {
      id: number;
      number: string;
      totalSales: number;
      quantity: number;
      profit: number;
    }
  >();

  filteredOrders.forEach((order: any) => {
    order.items.forEach((item: any) => {
      const productId = item.productId;
      const existing = productStats.get(productId) || {
        id: productId,
        number: item.product.number,
        totalSales: 0,
        quantity: 0,
        profit: 0,
      };

      existing.totalSales += Number(item.sum);
      existing.quantity += item.quantity;
      existing.profit +=
        Number(item.sum) - Number(item.product.costPrice || 0) * item.quantity;

      productStats.set(productId, existing);
    });
  });

  const topByVolume = Array.from(productStats.values())
    .sort((a, b) => b.totalSales - a.totalSales)
    .slice(0, 10);

  const topByProfit = Array.from(productStats.values())
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top Products by Volume */}
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
                  className="flex justify-between items-center pb-2 border-b"
                >
                  <div>
                    <p className="font-medium">
                      {idx + 1}. Товар {product.number}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Кол-во: {product.quantity} шт
                    </p>
                  </div>
                  <p className="font-bold">${product.totalSales.toFixed(2)}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Products by Profit */}
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
                  className="flex justify-between items-center pb-2 border-b"
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
                    ${product.profit.toFixed(2)}
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

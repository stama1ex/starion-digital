'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { filterByDateRange, type DateRange } from '../utils';
import type { AdminOrder, AdminRealization } from '../types';
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

interface TopProductsProps {
  orders: AdminOrder[];
  realizations: AdminRealization[];
  dateRange: DateRange;
  customDateRange?: { from: string; to: string } | null;
}

export default function TopProducts({
  orders,
  realizations,
  dateRange,
  customDateRange,
}: TopProductsProps) {
  const filteredOrders = filterByDateRange(
    orders,
    dateRange,
    customDateRange || undefined
  );

  const filteredRealizations = filterByDateRange(
    realizations,
    dateRange,
    customDateRange || undefined
  );

  type ProductStat = {
    id: number;
    number: string;
    totalSales: number;
    quantity: number;
    profit: number;
  };

  const productStats = new Map<number, ProductStat>();

  // Собираем ID заказов которые имеют реализацию
  const orderIdsWithRealization = new Set(
    filteredRealizations.map((r: any) => r.orderId)
  );

  // Считаем обычные заказы полностью (только те что НЕ в реализации)
  filteredOrders.forEach((order) => {
    // Пропускаем заказы которые конвертированы в реализацию
    if (orderIdsWithRealization.has(order.id)) {
      return;
    }

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

  // Считаем реализации только по оплаченному (paidAmount)
  filteredRealizations.forEach((realization) => {
    const totalCost = Number(realization.totalCost);
    const paidAmount = Number(realization.paidAmount);

    // Если ничего не оплачено, пропускаем
    if (paidAmount === 0) return;

    // Коэффициент оплаченной части
    const paidRatio = totalCost > 0 ? paidAmount / totalCost : 0;

    realization.items.forEach((item) => {
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

      // Считаем только оплаченную часть товара
      const paidSum = Number(item.totalPrice) * paidRatio;
      const paidQuantity = item.quantity * paidRatio;
      const costPerUnit = Number(item.costPrice ?? 0);
      const paidCost = costPerUnit * paidQuantity;

      existing.totalSales += paidSum;
      existing.quantity += paidQuantity;
      existing.profit += paidSum - paidCost;

      productStats.set(productId, existing);
    });
  });

  const stats = Array.from(productStats.values());

  const topByProfit = [...stats]
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10);

  // Подготовка данных для графика
  const chartData = topByProfit.map((product) => ({
    name: `Товар ${product.number}`,
    profit: Math.round(product.profit),
    revenue: Math.round(product.totalSales),
  }));

  return (
    <div className="space-y-6">
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
                  <div className="text-right">
                    <p className="font-medium text-green-600">
                      {product.profit.toFixed(0)} MDL
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {product.totalSales.toFixed(0)} MDL выручка
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>График прибыли по товарам</CardTitle>
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
                <Bar dataKey="profit" fill="#10b981" name="Прибыль" />
                <Bar dataKey="revenue" fill="#3b82f6" name="Выручка" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

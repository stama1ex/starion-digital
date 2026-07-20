/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { filterByDateRange, type DateRange } from '../utils';
import type { AdminOrder, AdminRealization } from '../types';
import { PRODUCT_TYPES, PRODUCT_TYPE_LABELS_PLURAL } from '@/lib/admin';
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
  const [selectedType, setSelectedType] = useState<string | null>(null);

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
    type: string;
    totalSales: number;
    quantity: number;
    profit: number;
  };

  const productStats = new Map<number, ProductStat>();

  // Собираем ID заказов которые имеют реализацию
  const orderIdsWithRealization = new Set(
    filteredRealizations.map((r: any) => r.orderId)
  );

  // Считаем обычные заказы (только те что НЕ в реализации)
  filteredOrders.forEach((order) => {
    // Пропускаем заказы которые конвертированы в реализацию
    if (orderIdsWithRealization.has(order.id)) {
      return;
    }

    // ✅ УЧИТЫВАЕМ ТОЛЬКО ОПЛАЧЕННЫЕ ЗАКАЗЫ
    if (order.status !== 'PAID') {
      return;
    }

    order.items.forEach((item: any) => {
      const productId = item.product.id;
      const productNumber = item.product.number;
      const existing =
        productStats.get(productId) ||
        ({
          id: productId,
          number: productNumber,
          type: item.product.type,
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

  filteredRealizations.forEach((realization) => {
    const totalCost = Number(realization.totalCost);
    const paidAmount = Number(realization.paidAmount);

    if (paidAmount === 0) return;

    const paidRatio = totalCost > 0 ? paidAmount / totalCost : 0;

    realization.items.forEach((item) => {
      const productId = item.product.id;
      const productNumber = item.product.number;
      const existing =
        productStats.get(productId) ||
        ({
          id: productId,
          number: productNumber,
          type: item.product.type,
          totalSales: 0,
          quantity: 0,
          profit: 0,
        } as ProductStat);

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

  // Группируем по типу товара, внутри группы сортируем по прибыли
  const typeOrder = [...PRODUCT_TYPES, 'STATUE', 'BALL'];
  const statsByType = typeOrder
    .map((type) => ({
      type,
      label: PRODUCT_TYPE_LABELS_PLURAL[type] || type,
      products: stats
        .filter((p) => p.type === type)
        .sort((a, b) => b.profit - a.profit),
    }))
    .filter((group) => group.products.length > 0);

  const activeGroup =
    statsByType.find((group) => group.type === selectedType) ??
    statsByType[0];

  const chartData = (activeGroup?.products ?? []).map((product) => ({
    name: `Товар ${product.number}`,
    profit: Math.round(product.profit),
    revenue: Math.round(product.totalSales),
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between space-y-0 gap-4">
          <CardTitle>Товары по прибыли</CardTitle>
          {statsByType.length > 0 && (
            <Select
              value={activeGroup?.type}
              onValueChange={setSelectedType}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Тип товара" />
              </SelectTrigger>
              <SelectContent>
                {statsByType.map((group) => (
                  <SelectItem key={group.type} value={group.type}>
                    {group.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent>
          {!activeGroup ? (
            <p className="text-muted-foreground">
              Нет данных за выбранный период
            </p>
          ) : (
            <div className="space-y-3">
              {activeGroup.products.map((product, idx) => (
                <div
                  key={`product-${product.id}`}
                  className="flex justify-between items-center pb-2 border-b last:border-b-0"
                >
                  <div>
                    <p className="font-medium">
                      {idx + 1}. Товар {product.number}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Кол-во: {Math.round(product.quantity)} шт
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              График прибыли: {activeGroup?.label}
            </CardTitle>
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

/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface SalesAnalyticsProps {
  orders: any[];
  realizations: any[];
  partners: any[];
  dateRange: 'day' | 'week' | 'month';
  customDateRange?: { from: string; to: string } | null;
}

export default function SalesAnalytics({
  orders,
  realizations,
  partners,
  dateRange,
  customDateRange,
}: SalesAnalyticsProps) {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('ALL');
  const [partnerSearchQuery, setPartnerSearchQuery] = useState('');

  // Фильтрация по партнеру
  const partnerFilteredOrders =
    selectedPartnerId === 'ALL'
      ? orders
      : orders.filter((o) => o.partnerId.toString() === selectedPartnerId);

  const partnerFilteredRealizations =
    selectedPartnerId === 'ALL'
      ? realizations
      : realizations.filter(
          (r) => r.partnerId.toString() === selectedPartnerId,
        );

  const filteredOrders = filterByDateRange(
    partnerFilteredOrders,
    dateRange,
    customDateRange || undefined,
  );

  const filteredRealizations = filterByDateRange(
    partnerFilteredRealizations,
    dateRange,
    customDateRange || undefined,
  );

  // Фильтрация списка партнеров для поиска
  const filteredPartners = partners.filter((p) =>
    p.name.toLowerCase().includes(partnerSearchQuery.toLowerCase()),
  );

  // Маппер себестоимости (в дальнейшем можно получать из БД)
  const metrics = calculateMetrics(filteredOrders, filteredRealizations);

  // === Построение данных графика по дням ===
  const dateMap = new Map<
    string,
    { revenue: number; cost: number; profit: number }
  >();

  // Собираем ID заказов которые имеют реализацию
  const orderIdsWithRealization = new Set(
    filteredRealizations.map((r: any) => r.orderId),
  );

  // Добавляем обычные заказы (считаются полностью, только те что НЕ в реализации)
  filteredOrders.forEach((order) => {
    // Пропускаем заказы которые конвертированы в реализацию
    if (orderIdsWithRealization.has(order.id)) {
      return;
    }

    // ✅ УЧИТЫВАЕМ ТОЛЬКО ОПЛАЧЕННЫЕ ЗАКАЗЫ
    if (order.status !== 'PAID') {
      return;
    }

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

  // Добавляем реализации (считаются только по paidAmount, дата платежа)
  filteredRealizations.forEach((realization) => {
    // Для каждого платежа по этой реализации
    realization.payments.forEach((payment: any) => {
      const paymentDate = new Date(payment.createdAt)
        .toISOString()
        .split('T')[0];

      const existing = dateMap.get(paymentDate) || {
        revenue: 0,
        cost: 0,
        profit: 0,
      };

      const paymentAmount = Number(payment.amount);

      // Считаем себестоимость пропорционально оплаченной сумме
      const realizationRatio =
        Number(realization.totalCost) > 0
          ? paymentAmount / Number(realization.totalCost)
          : 0;

      const paymentCost = realization.items.reduce((sum: number, item: any) => {
        return (
          sum + Number(item.costPrice ?? 0) * item.quantity * realizationRatio
        );
      }, 0);

      existing.revenue += paymentAmount;
      existing.cost += paymentCost;
      existing.profit += paymentAmount - paymentCost;

      dateMap.set(paymentDate, existing);
    });
  });

  // === Сортируем по ISO дате (старые -> новые), потом форматируем ===
  const sortedEntries = Array.from(dateMap.entries()).sort(
    ([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime(),
  );

  const chartData = sortedEntries.map(([date, data]) => {
    const d = new Date(date);
    const months = [
      'янв',
      'фев',
      'мар',
      'апр',
      'мая',
      'июн',
      'июл',
      'авг',
      'сен',
      'окт',
      'ноя',
      'дек',
    ];
    const formattedDate = `${d.getDate()} ${months[d.getMonth()]}`;

    return {
      date: formattedDate,
      revenue: Math.round(data.revenue),
      cost: Math.round(data.cost),
      profit: Math.round(data.profit),
    };
  });

  const periodLabel = customDateRange
    ? `с ${customDateRange.from} по ${customDateRange.to}`
    : {
        day: 'Сегодня',
        week: 'На этой неделе',
        month: 'В этом месяце',
      }[dateRange];

  return (
    <div className="space-y-6">
      {/* Фильтр по партнеру */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-card p-4 rounded-lg border shadow-sm">
        <div className="flex-1 w-full sm:w-auto">
          <label className="text-sm font-medium mb-1 block">
            Поиск партнера
          </label>
          <Input
            placeholder="Введите имя..."
            value={partnerSearchQuery}
            onChange={(e) => setPartnerSearchQuery(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <div className="flex-1 w-full sm:w-auto">
          <label className="text-sm font-medium mb-1 block">
            Выберите партнера
          </label>
          <div className="flex gap-2">
            <Select
              value={selectedPartnerId}
              onValueChange={setSelectedPartnerId}
            >
              <SelectTrigger className="w-full sm:w-62.5">
                <SelectValue placeholder="Все партнеры" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все партнеры</SelectItem>
                {filteredPartners.map((partner) => (
                  <SelectItem key={partner.id} value={partner.id.toString()}>
                    {partner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPartnerId !== 'ALL' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSelectedPartnerId('ALL');
                  setPartnerSearchQuery('');
                }}
                title="Сбросить фильтр"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

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
              {filteredOrders.length} заказов + {filteredRealizations.length}{' '}
              реализаций
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
                    1,
                  )
                : 0}
              %
            </p>
          </CardContent>
        </Card>
      </div>

      {/* === Таблица со статистикой по статусам === */}
      <Card>
        <CardHeader>
          <CardTitle>Статистика по статусам заказов</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Статус</th>
                  <th className="text-right py-3 px-4 font-semibold">
                    Сумма (MDL)
                  </th>
                  <th className="text-right py-3 px-4 font-semibold">
                    Кол-во заказов
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Расчет сумм по статусам (только оплаченные и подтвержденные)
                  const statusStats = {
                    CONFIRMED: { sum: 0, count: 0 },
                    PAID: { sum: 0, count: 0 },
                  };

                  filteredOrders.forEach((order) => {
                    if (
                      order.status === 'CONFIRMED' ||
                      order.status === 'PAID'
                    ) {
                      const amount = Number(order.totalPrice);
                      const status = order.status as 'CONFIRMED' | 'PAID';
                      statusStats[status].sum += amount;
                      statusStats[status].count += 1;
                    }
                  });

                  const totalSum =
                    statusStats.CONFIRMED.sum + statusStats.PAID.sum;
                  const totalCount =
                    statusStats.CONFIRMED.count + statusStats.PAID.count;

                  return (
                    <>
                      <tr className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Подтвережденные
                          </span>
                        </td>
                        <td className="text-right py-3 px-4 font-semibold">
                          {statusStats.CONFIRMED.sum.toFixed(2)}
                        </td>
                        <td className="text-right py-3 px-4">
                          {statusStats.CONFIRMED.count}
                        </td>
                      </tr>
                      <tr className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Оплаченные
                          </span>
                        </td>
                        <td className="text-right py-3 px-4 font-semibold">
                          {statusStats.PAID.sum.toFixed(2)}
                        </td>
                        <td className="text-right py-3 px-4">
                          {statusStats.PAID.count}
                        </td>
                      </tr>
                      <tr className="border-b hover:bg-muted/50 bg-muted/40">
                        <td className="py-3 px-4 font-semibold">Всего</td>
                        <td className="text-right py-3 px-4 font-semibold">
                          {totalSum.toFixed(2)}
                        </td>
                        <td className="text-right py-3 px-4 font-semibold">
                          {totalCount}
                        </td>
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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

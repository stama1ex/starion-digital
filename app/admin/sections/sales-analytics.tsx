/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { filterByDateRange, calculateMetrics, type DateRange } from '../utils';
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
  dateRange: DateRange;
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
  const [chartFromDate, setChartFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 11);
    return d.toISOString().split('T')[0];
  });
  const [chartToDate, setChartToDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [chartMode, setChartMode] = useState<'day' | 'week' | 'month' | 'year'>(
    'month',
  );

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

  const chartData = useMemo(() => {
    const rangeStart = new Date(`${chartFromDate}T00:00:00`);
    const rangeEnd = new Date(`${chartToDate}T23:59:59`);

    if (
      Number.isNaN(rangeStart.getTime()) ||
      Number.isNaN(rangeEnd.getTime()) ||
      rangeStart > rangeEnd
    ) {
      return [];
    }

    const startOfPeriod = (date: Date) => {
      const d = new Date(date);
      if (chartMode === 'day') {
        d.setHours(0, 0, 0, 0);
        return d;
      }

      if (chartMode === 'week') {
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diff);
        d.setHours(0, 0, 0, 0);
        return d;
      }

      if (chartMode === 'month') {
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
      }

      d.setMonth(0, 1);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const shiftPeriod = (date: Date, delta: number) => {
      const d = new Date(date);
      if (chartMode === 'day') {
        d.setDate(d.getDate() + delta);
        return d;
      }

      if (chartMode === 'week') {
        d.setDate(d.getDate() + delta * 7);
        return d;
      }

      if (chartMode === 'month') {
        d.setMonth(d.getMonth() + delta);
        return d;
      }

      d.setFullYear(d.getFullYear() + delta);
      return d;
    };

    const formatLabel = (date: Date) => {
      if (chartMode === 'day') {
        return new Intl.DateTimeFormat('ru-RU', {
          day: '2-digit',
          month: '2-digit',
        }).format(date);
      }

      if (chartMode === 'month') {
        return new Intl.DateTimeFormat('ru-RU', {
          month: 'short',
          year: 'numeric',
        }).format(date);
      }

      if (chartMode === 'week') {
        return `Нед ${new Intl.DateTimeFormat('ru-RU', {
          day: '2-digit',
          month: '2-digit',
        }).format(date)}`;
      }

      return new Intl.DateTimeFormat('ru-RU', { year: 'numeric' }).format(date);
    };

    const periods: Array<{
      period: string;
      revenue: number;
      cost: number;
      profit: number;
    }> = [];

    const orderIdsWithRealization = new Set(
      partnerFilteredRealizations.map((r: any) => r.orderId),
    );

    let periodStart = startOfPeriod(rangeStart);
    let guard = 0;

    while (periodStart <= rangeEnd && guard < 600) {
      const nextPeriodStart = shiftPeriod(periodStart, 1);
      const periodEnd = new Date(nextPeriodStart.getTime() - 1);

      let revenue = 0;
      let cost = 0;

      partnerFilteredOrders.forEach((order) => {
        const createdAt = new Date(order.createdAt);
        if (createdAt < periodStart || createdAt > periodEnd) {
          return;
        }

        if (orderIdsWithRealization.has(order.id) || order.status !== 'PAID') {
          return;
        }

        const orderRevenue = Number(order.totalPrice);
        const orderCost = order.items.reduce((sum: number, item: any) => {
          return sum + Number(item.product.costPrice ?? 0) * item.quantity;
        }, 0);

        revenue += orderRevenue;
        cost += orderCost;
      });

      partnerFilteredRealizations.forEach((realization) => {
        realization.payments.forEach((payment: any) => {
          const paymentDateRaw = (payment as any).paymentDate || payment.createdAt;
          const paymentDate = new Date(paymentDateRaw);

          if (paymentDate < periodStart || paymentDate > periodEnd) {
            return;
          }

          const paymentAmount = Number(payment.amount);
          const realizationRatio =
            Number(realization.totalCost) > 0
              ? paymentAmount / Number(realization.totalCost)
              : 0;

          const paymentCost = realization.items.reduce(
            (sum: number, item: any) => {
              return (
                sum + Number(item.costPrice ?? 0) * item.quantity * realizationRatio
              );
            },
            0,
          );

          revenue += paymentAmount;
          cost += paymentCost;
        });
      });

      periods.push({
        period: formatLabel(periodStart),
        revenue: Math.round(revenue),
        cost: Math.round(cost),
        profit: Math.round(revenue - cost),
      });

      periodStart = nextPeriodStart;
      guard += 1;
    }

    return periods;
  }, [
    chartFromDate,
    chartMode,
    chartToDate,
    partnerFilteredOrders,
    partnerFilteredRealizations,
  ]);

  const periodLabel = customDateRange
    ? `с ${customDateRange.from} по ${customDateRange.to}`
    : {
        day: 'Сегодня',
        week: 'На этой неделе',
        month: 'В этом месяце',
        all: 'За все время',
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
            <div className="mb-4 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">От:</span>
                  <input
                    type="date"
                    value={chartFromDate}
                    onChange={(e) => setChartFromDate(e.target.value)}
                    className="px-3 py-2 border rounded bg-background text-foreground text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">До:</span>
                  <input
                    type="date"
                    value={chartToDate}
                    onChange={(e) => setChartToDate(e.target.value)}
                    className="px-3 py-2 border rounded bg-background text-foreground text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setChartMode('day')}
                  className={`px-3 py-2 text-sm rounded cursor-pointer ${
                    chartMode === 'day'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground'
                  }`}
                >
                  По дням
                </button>
                <button
                  onClick={() => setChartMode('week')}
                  className={`px-3 py-2 text-sm rounded cursor-pointer ${
                    chartMode === 'week'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground'
                  }`}
                >
                  Понедельно
                </button>
                <button
                  onClick={() => setChartMode('month')}
                  className={`px-3 py-2 text-sm rounded cursor-pointer ${
                    chartMode === 'month'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground'
                  }`}
                >
                  Помесячно
                </button>
                <button
                  onClick={() => setChartMode('year')}
                  className={`px-3 py-2 text-sm rounded cursor-pointer ${
                    chartMode === 'year'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground'
                  }`}
                >
                  По годам
                </button>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip formatter={(value) => `${value} MDL`} />
                <Legend />
                <Bar dataKey="revenue" fill="#3b82f6" name="Выручка" />
                <Bar dataKey="profit" fill="#10b981" name="Прибыль" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

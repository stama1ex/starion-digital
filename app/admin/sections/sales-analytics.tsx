/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown, Search, X } from 'lucide-react';

type ChartMode = 'day' | 'week' | 'month' | 'year';

type ChartPoint = {
  period: string;
  revenue: number;
  incomingSales: number;
  cost: number;
  profit: number;
};

type ChartSeries = {
  dataKey: keyof ChartPoint;
  fill: string;
  name: string;
};

type ChartRangeState = {
  fromDate: string;
  toDate: string;
  mode: ChartMode;
};

type TimeRangeControlsProps = {
  fromDate: string;
  toDate: string;
  mode: ChartMode;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onModeChange: (value: ChartMode) => void;
};

type AnalyticsChartCardProps = {
  title: string;
  chartData: ChartPoint[];
  controls: TimeRangeControlsProps;
  series: ChartSeries[];
};

function TimeRangeControls({
  fromDate,
  toDate,
  mode,
  onFromDateChange,
  onToDateChange,
  onModeChange,
}: TimeRangeControlsProps) {
  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">От:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
            className="px-3 py-2 border rounded bg-background text-foreground text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">До:</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => onToDateChange(e.target.value)}
            className="px-3 py-2 border rounded bg-background text-foreground text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onModeChange('day')}
          className={`px-3 py-2 text-sm rounded cursor-pointer ${
            mode === 'day'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-foreground'
          }`}
        >
          По дням
        </button>
        <button
          onClick={() => onModeChange('week')}
          className={`px-3 py-2 text-sm rounded cursor-pointer ${
            mode === 'week'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-foreground'
          }`}
        >
          Понедельно
        </button>
        <button
          onClick={() => onModeChange('month')}
          className={`px-3 py-2 text-sm rounded cursor-pointer ${
            mode === 'month'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-foreground'
          }`}
        >
          Помесячно
        </button>
        <button
          onClick={() => onModeChange('year')}
          className={`px-3 py-2 text-sm rounded cursor-pointer ${
            mode === 'year'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-foreground'
          }`}
        >
          По годам
        </button>
      </div>
    </div>
  );
}

function AnalyticsChartCard({
  title,
  chartData,
  controls,
  series,
}: AnalyticsChartCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <TimeRangeControls {...controls} />

        {chartData.length === 0 ? (
          <div
            className="flex items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
            style={{ height: 300 }}
          >
            Нет данных для выбранного периода
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value) => `${value} MDL`} />
              <Legend />
              {series.map((item) => (
                <Bar
                  key={item.name}
                  dataKey={item.dataKey}
                  fill={item.fill}
                  name={item.name}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function buildChartData(
  orders: any[],
  realizations: any[],
  fromDate: string,
  toDate: string,
  mode: ChartMode,
) {
  const rangeStart = new Date(`${fromDate}T00:00:00`);
  const rangeEnd = new Date(`${toDate}T23:59:59`);

  if (
    Number.isNaN(rangeStart.getTime()) ||
    Number.isNaN(rangeEnd.getTime()) ||
    rangeStart > rangeEnd
  ) {
    return [] as ChartPoint[];
  }

  const startOfPeriod = (date: Date) => {
    const d = new Date(date);
    if (mode === 'day') {
      d.setHours(0, 0, 0, 0);
      return d;
    }

    if (mode === 'week') {
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      d.setHours(0, 0, 0, 0);
      return d;
    }

    if (mode === 'month') {
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
    if (mode === 'day') {
      d.setDate(d.getDate() + delta);
      return d;
    }

    if (mode === 'week') {
      d.setDate(d.getDate() + delta * 7);
      return d;
    }

    if (mode === 'month') {
      d.setMonth(d.getMonth() + delta);
      return d;
    }

    d.setFullYear(d.getFullYear() + delta);
    return d;
  };

  const formatLabel = (date: Date) => {
    if (mode === 'day') {
      return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
      }).format(date);
    }

    if (mode === 'month') {
      return new Intl.DateTimeFormat('ru-RU', {
        month: 'short',
        year: 'numeric',
      }).format(date);
    }

    if (mode === 'week') {
      return `Нед ${new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
      }).format(date)}`;
    }

    return new Intl.DateTimeFormat('ru-RU', { year: 'numeric' }).format(date);
  };

  const periods: ChartPoint[] = [];

  const orderIdsWithRealization = new Set(
    realizations.map((r: any) => r.orderId),
  );

  let periodStart = startOfPeriod(rangeStart);
  let guard = 0;

  while (periodStart <= rangeEnd && guard < 600) {
    const nextPeriodStart = shiftPeriod(periodStart, 1);
    const periodEnd = new Date(nextPeriodStart.getTime() - 1);

    let revenue = 0;
    let incomingSales = 0;
    let cost = 0;

    orders.forEach((order) => {
      const createdAt = new Date(order.createdAt);
      if (createdAt < periodStart || createdAt > periodEnd) {
        return;
      }

      if (orderIdsWithRealization.has(order.id)) {
        return;
      }

      if (order.status === 'CONFIRMED' || order.status === 'PAID') {
        incomingSales += Number(order.totalPrice);
      }

      if (order.status !== 'PAID') {
        return;
      }

      const orderRevenue = Number(order.totalPrice);
      const orderCost = order.items.reduce((sum: number, item: any) => {
        return sum + Number(item.product.costPrice ?? 0) * item.quantity;
      }, 0);

      revenue += orderRevenue;
      cost += orderCost;
    });

    realizations.forEach((realization) => {
      realization.payments.forEach((payment: any) => {
        const paymentDateRaw =
          (payment as any).paymentDate || payment.createdAt;
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
              sum +
              Number(item.costPrice ?? 0) * item.quantity * realizationRatio
            );
          },
          0,
        );

        incomingSales += paymentAmount;
        revenue += paymentAmount;
        cost += paymentCost;
      });
    });

    periods.push({
      period: formatLabel(periodStart),
      revenue: Math.round(revenue),
      incomingSales: Math.round(incomingSales),
      cost: Math.round(cost),
      profit: Math.round(revenue - cost),
    });

    periodStart = nextPeriodStart;
    guard += 1;
  }

  return periods;
}

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
  const [isPartnerComboboxOpen, setIsPartnerComboboxOpen] = useState(false);
  const [salesChartRange, setSalesChartRange] = useState<ChartRangeState>(
    () => {
      const d = new Date();
      d.setMonth(d.getMonth() - 11);
      const fromDate = d.toISOString().split('T')[0];
      return {
        fromDate,
        toDate: new Date().toISOString().split('T')[0],
        mode: 'month',
      };
    },
  );
  const [incomingChartRange, setIncomingChartRange] = useState<ChartRangeState>(
    () => {
      const d = new Date();
      d.setMonth(d.getMonth() - 11);
      const fromDate = d.toISOString().split('T')[0];
      return {
        fromDate,
        toDate: new Date().toISOString().split('T')[0],
        mode: 'month',
      };
    },
  );
  const partnerComboboxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        partnerComboboxRef.current &&
        !partnerComboboxRef.current.contains(event.target as Node)
      ) {
        setIsPartnerComboboxOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const selectedPartnerName =
    selectedPartnerId === 'ALL'
      ? 'Все партнеры'
      : partners.find((partner) => partner.id.toString() === selectedPartnerId)
          ?.name || 'Все партнеры';

  // Маппер себестоимости (в дальнейшем можно получать из БД)
  const metrics = calculateMetrics(filteredOrders, filteredRealizations);

  const salesChartData = useMemo(
    () =>
      buildChartData(
        partnerFilteredOrders,
        partnerFilteredRealizations,
        salesChartRange.fromDate,
        salesChartRange.toDate,
        salesChartRange.mode,
      ),
    [
      partnerFilteredOrders,
      partnerFilteredRealizations,
      salesChartRange.fromDate,
      salesChartRange.mode,
      salesChartRange.toDate,
    ],
  );

  const incomingChartData = useMemo(
    () =>
      buildChartData(
        partnerFilteredOrders,
        partnerFilteredRealizations,
        incomingChartRange.fromDate,
        incomingChartRange.toDate,
        incomingChartRange.mode,
      ),
    [
      partnerFilteredOrders,
      partnerFilteredRealizations,
      incomingChartRange.fromDate,
      incomingChartRange.mode,
      incomingChartRange.toDate,
    ],
  );

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
        <div ref={partnerComboboxRef} className="relative w-full max-w-xs">
          <label className="text-sm font-medium mb-1 block">Партнер</label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between gap-2"
              onClick={() => {
                setIsPartnerComboboxOpen((open) => !open);
                setPartnerSearchQuery(
                  selectedPartnerName === 'Все партнеры'
                    ? ''
                    : selectedPartnerName,
                );
              }}
            >
              <span className="truncate text-left">{selectedPartnerName}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
            </Button>
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

          {isPartnerComboboxOpen && (
            <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-md border bg-popover p-2 shadow-md">
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  value={partnerSearchQuery}
                  onChange={(e) => setPartnerSearchQuery(e.target.value)}
                  placeholder="Поиск партнера..."
                  className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
                  autoFocus
                />
              </div>

              <div className="mt-2 max-h-72 overflow-y-auto">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    setSelectedPartnerId('ALL');
                    setPartnerSearchQuery('');
                    setIsPartnerComboboxOpen(false);
                  }}
                >
                  <span className="truncate">Все партнеры</span>
                  {selectedPartnerId === 'ALL' && (
                    <Check className="h-4 w-4 shrink-0" />
                  )}
                </button>

                {filteredPartners.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground">
                    Партнер не найден
                  </div>
                ) : (
                  filteredPartners.map((partner) => {
                    const isSelected =
                      partner.id.toString() === selectedPartnerId;

                    return (
                      <button
                        key={partner.id}
                        type="button"
                        className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                        onClick={() => {
                          setSelectedPartnerId(partner.id.toString());
                          setPartnerSearchQuery(partner.name);
                          setIsPartnerComboboxOpen(false);
                        }}
                      >
                        <span className="truncate">{partner.name}</span>
                        {isSelected && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
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

      <AnalyticsChartCard
        title="Динамика продаж"
        chartData={salesChartData}
        controls={{
          fromDate: salesChartRange.fromDate,
          toDate: salesChartRange.toDate,
          mode: salesChartRange.mode,
          onFromDateChange: (value) =>
            setSalesChartRange((prev) => ({ ...prev, fromDate: value })),
          onToDateChange: (value) =>
            setSalesChartRange((prev) => ({ ...prev, toDate: value })),
          onModeChange: (value) =>
            setSalesChartRange((prev) => ({ ...prev, mode: value })),
        }}
        series={[
          { dataKey: 'revenue', fill: '#3b82f6', name: 'Выручка' },
          { dataKey: 'profit', fill: '#10b981', name: 'Прибыль' },
        ]}
      />

      <AnalyticsChartCard
        title="Поступления продаж"
        chartData={incomingChartData}
        controls={{
          fromDate: incomingChartRange.fromDate,
          toDate: incomingChartRange.toDate,
          mode: incomingChartRange.mode,
          onFromDateChange: (value) =>
            setIncomingChartRange((prev) => ({ ...prev, fromDate: value })),
          onToDateChange: (value) =>
            setIncomingChartRange((prev) => ({ ...prev, toDate: value })),
          onModeChange: (value) =>
            setIncomingChartRange((prev) => ({ ...prev, mode: value })),
        }}
        series={[
          { dataKey: 'incomingSales', fill: '#f59e0b', name: 'Поступления' },
          { dataKey: 'revenue', fill: '#3b82f6', name: 'Оплачено' },
        ]}
      />
    </div>
  );
}

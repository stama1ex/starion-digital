/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useMemo, useState } from 'react';
import ReactCountryFlag from 'react-country-flag';
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
import { PRODUCT_TYPE_LABELS_PLURAL } from '@/lib/admin';
import { formatMDL } from '@/lib/format-money';

// Расшифровка кодов стран сувениров для читаемого отображения в аналитике.
// Пополняется по мере необходимости — остальные коды показываются как есть.
const COUNTRY_LABELS: Record<string, string> = {
  MD: 'Молдова',
  RO: 'Румыния',
  ES: 'Испания',
  GB: 'Англия',
  RU: 'Россия',
};

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

type BreakdownRow = {
  key: string;
  label: string;
  revenue: number;
  profit: number;
  flagCode?: string;
};

function BreakdownCard({
  title,
  rows,
  totalRevenue,
  emptyLabel,
  barColor,
}: {
  title: string;
  rows: BreakdownRow[];
  totalRevenue: number;
  emptyLabel: string;
  barColor: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const pct =
                totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0;

              return (
                <div key={row.key} className="flex items-center gap-3">
                  <span
                    className="w-28 sm:w-36 text-sm truncate shrink-0 flex items-center gap-1.5"
                    title={row.label}
                  >
                    {row.flagCode && (
                      <ReactCountryFlag
                        countryCode={row.flagCode}
                        svg
                        className="shrink-0"
                      />
                    )}
                    <span className="truncate">{row.label}</span>
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-36 sm:w-44 text-right shrink-0">
                    {formatMDL(row.revenue, 0)} ({pct.toFixed(1)}%)
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
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
              <Tooltip formatter={(value) => formatMDL(value as number, 0)} />
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

      // НДС исключаем из выручки/прибыли - это не доход компании
      const orderRevenue = Number(order.totalPrice) - Number(order.vatAmount);
      const orderCost = order.items.reduce((sum: number, item: any) => {
        return sum + Number(item.product.group?.costPrice ?? 0) * item.quantity;
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
  selectedPartnerId: string;
  dateRange: DateRange;
  customDateRange?: { from: string; to: string } | null;
}

export default function SalesAnalytics({
  orders,
  realizations,
  selectedPartnerId,
  dateRange,
  customDateRange,
}: SalesAnalyticsProps) {
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

  // Маппер себестоимости (в дальнейшем можно получать из БД)
  const metrics = calculateMetrics(filteredOrders, filteredRealizations);

  // Разбивка выручки по типу товара и по стране сувенира — считаем так же,
  // как оборот в KPI-блоках выше: только оплаченные обычные заказы + оплаченная
  // часть реализаций, без НДС (item.sum/item.totalPrice уже без НДС).
  const revenueByType = new Map<string, { revenue: number; profit: number }>();
  const revenueByCountry = new Map<
    string,
    { revenue: number; profit: number }
  >();

  const addToBreakdown = (
    map: Map<string, { revenue: number; profit: number }>,
    key: string,
    revenue: number,
    profit: number,
  ) => {
    const existing = map.get(key) || { revenue: 0, profit: 0 };
    existing.revenue += revenue;
    existing.profit += profit;
    map.set(key, existing);
  };

  const breakdownOrderIdsWithRealization = new Set(
    filteredRealizations.map((r) => r.orderId),
  );

  filteredOrders.forEach((order) => {
    if (breakdownOrderIdsWithRealization.has(order.id)) return;
    if (order.status !== 'PAID') return;

    order.items.forEach((item: any) => {
      const sum = Number(item.sum);
      const cost = Number(item.product.group?.costPrice ?? 0) * item.quantity;
      const profit = sum - cost;

      addToBreakdown(revenueByType, item.product.type, sum, profit);
      addToBreakdown(
        revenueByCountry,
        item.product.country?.toUpperCase() || 'Не указана',
        sum,
        profit,
      );
    });
  });

  filteredRealizations.forEach((realization) => {
    const totalCost = Number(realization.totalCost);
    const paidAmount = Number(realization.paidAmount);
    if (paidAmount === 0) return;

    const paidRatio = totalCost > 0 ? paidAmount / totalCost : 0;

    realization.items.forEach((item: any) => {
      const paidSum = Number(item.totalPrice) * paidRatio;
      const paidQuantity = item.quantity * paidRatio;
      const cost = Number(item.costPrice ?? 0) * paidQuantity;
      const profit = paidSum - cost;

      addToBreakdown(revenueByType, item.product.type, paidSum, profit);
      addToBreakdown(
        revenueByCountry,
        item.product.country?.toUpperCase() || 'Не указана',
        paidSum,
        profit,
      );
    });
  });

  const typeRows: BreakdownRow[] = Array.from(revenueByType.entries())
    .map(([type, stat]) => ({
      key: type,
      label: PRODUCT_TYPE_LABELS_PLURAL[type] || type,
      revenue: stat.revenue,
      profit: stat.profit,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const TOP_COUNTRIES_LIMIT = 8;
  const sortedCountryEntries = Array.from(revenueByCountry.entries()).sort(
    (a, b) => b[1].revenue - a[1].revenue,
  );
  const countryRows: BreakdownRow[] = sortedCountryEntries
    .slice(0, TOP_COUNTRIES_LIMIT)
    .map(([country, stat]) => ({
      key: country,
      label: COUNTRY_LABELS[country] || country,
      revenue: stat.revenue,
      profit: stat.profit,
      flagCode: COUNTRY_LABELS[country] ? country : undefined,
    }));
  const restCountries = sortedCountryEntries.slice(TOP_COUNTRIES_LIMIT);
  if (restCountries.length > 0) {
    const restStat = restCountries.reduce(
      (acc, [, stat]) => ({
        revenue: acc.revenue + stat.revenue,
        profit: acc.profit + stat.profit,
      }),
      { revenue: 0, profit: 0 },
    );
    countryRows.push({
      key: '__rest__',
      label: `Остальные (${restCountries.length})`,
      revenue: restStat.revenue,
      profit: restStat.profit,
    });
  }

  const typeRevenueTotal = typeRows.reduce((acc, row) => acc + row.revenue, 0);
  const countryRevenueTotal = sortedCountryEntries.reduce(
    (acc, [, stat]) => acc + stat.revenue,
    0,
  );

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
              {formatMDL(metrics.totalRevenue, 0)}
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
              {formatMDL(metrics.totalCost, 0)}
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
              {formatMDL(metrics.grossProfit, 0)}
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

      {/* === Разбивка выручки по типу товара и по стране === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownCard
          title={`Продажи по типам товара ${periodLabel}`}
          rows={typeRows}
          totalRevenue={typeRevenueTotal}
          emptyLabel="Нет продаж за выбранный период"
          barColor="bg-blue-500"
        />

        <BreakdownCard
          title={`Продажи по странам сувениров ${periodLabel}`}
          rows={countryRows}
          totalRevenue={countryRevenueTotal}
          emptyLabel="Нет продаж за выбранный период"
          barColor="bg-emerald-500"
        />
      </div>

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

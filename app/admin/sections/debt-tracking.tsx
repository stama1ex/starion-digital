/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { filterByDateRange, type DateRange } from '../utils';
import type { AdminOrder, AdminPartner, AdminRealization } from '../types';
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

interface DebtTrackingProps {
  orders: AdminOrder[];
  realizations: AdminRealization[];
  partners: AdminPartner[];
  dateRange: DateRange;
  customDateRange?: { from: string; to: string } | null;
}

export default function DebtTracking({
  orders,
  realizations,
  partners,
  dateRange,
  customDateRange,
}: DebtTrackingProps) {
  const filteredOrders = filterByDateRange(
    orders,
    dateRange,
    customDateRange || undefined,
  );
  const filteredRealizations = filterByDateRange(
    realizations,
    dateRange,
    customDateRange || undefined,
  );
  const [chartFromDate, setChartFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 11);
    return d.toISOString().split('T')[0];
  });
  const [chartToDate, setChartToDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [partnerSearchQuery, setPartnerSearchQuery] = useState('');
  const [chartMode, setChartMode] = useState<'day' | 'week' | 'month' | 'year'>(
    'month',
  );

  const normalizedPartnerQuery = partnerSearchQuery.trim().toLowerCase();
  const matchingPartnerIds = new Set(
    partners
      .filter((partner) =>
        partner.name.toLowerCase().includes(normalizedPartnerQuery),
      )
      .map((partner) => partner.id),
  );

  const debtOrders = filteredOrders.filter((order) =>
    normalizedPartnerQuery ? matchingPartnerIds.has(order.partnerId) : true,
  );
  const debtRealizations = filteredRealizations.filter((realization) =>
    normalizedPartnerQuery
      ? matchingPartnerIds.has(realization.partnerId)
      : true,
  );

  const chartOrders = orders.filter((order) =>
    normalizedPartnerQuery ? matchingPartnerIds.has(order.partnerId) : true,
  );
  const chartRealizations = realizations.filter((realization) =>
    normalizedPartnerQuery
      ? matchingPartnerIds.has(realization.partnerId)
      : true,
  );

  type Balance = {
    id: number;
    name: string;
    phone: string | null;
    ordersTotal: number;
    realizationTotal: number;
    realizationPaid: number;
    balance: number;
  };

  const balances = new Map<number, Balance>();

  const ensureBalance = (
    partnerId: number,
    name: string,
    phone?: string | null,
  ) => {
    const existing = balances.get(partnerId);
    if (existing) {
      return existing;
    }

    const next: Balance = {
      id: partnerId,
      name,
      phone: phone ?? null,
      ordersTotal: 0,
      realizationTotal: 0,
      realizationPaid: 0,
      balance: 0,
    };

    balances.set(partnerId, next);
    return next;
  };

  partners.forEach((partner) => {
    ensureBalance(partner.id, partner.name, partner.phone);
  });

  const orderIdsWithRealization = new Set(
    debtRealizations.map((realization) => realization.orderId),
  );

  // Считаем CONFIRMED заказы. Если это заказ на реализацию и у него нет
  // отдельной записи Realization, учитываем его как долг по реализации.
  debtOrders.forEach((order) => {
    if (order.status !== 'CONFIRMED') {
      return;
    }

    const existing = ensureBalance(order.partnerId, order.partner.name);

    if ((order as any).isRealization) {
      if (!orderIdsWithRealization.has(order.id)) {
        existing.realizationTotal += Number(order.totalPrice);
      }
      return;
    }

    existing.ordersTotal += Number(order.totalPrice);
  });

  // Считаем только активные реализации (не CANCELLED)
  debtRealizations.forEach((real) => {
    const existing = ensureBalance(real.partnerId, real.partner.name);
    if (real.status !== 'CANCELLED') {
      existing.realizationTotal += Number(real.totalCost);
      existing.realizationPaid += Number(real.paidAmount);
    }
  });

  balances.forEach((b) => {
    b.balance = b.ordersTotal + (b.realizationTotal - b.realizationPaid);
  });

  const balancesList = Array.from(balances.values()).filter(
    (b) => b.balance !== 0,
  );

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
      orders: number;
      realization: number;
    }> = [];

    let periodStart = startOfPeriod(rangeStart);
    let guard = 0;

    while (periodStart <= rangeEnd && guard < 600) {
      const nextPeriodStart = shiftPeriod(periodStart, 1);
      const periodEnd = new Date(nextPeriodStart.getTime() - 1);

      let ordersDebt = 0;
      let realizationTotal = 0;
      let realizationPaid = 0;

      chartOrders.forEach((order) => {
        const createdAt = new Date(order.createdAt);
        if (
          createdAt <= periodEnd &&
          order.status === 'CONFIRMED' &&
          !(order as any).isRealization
        ) {
          ordersDebt += Number(order.totalPrice);
        }
      });

      chartRealizations.forEach((realization) => {
        const createdAt = new Date(realization.createdAt);
        if (realization.status === 'CANCELLED' || createdAt > periodEnd) {
          return;
        }

        realizationTotal += Number(realization.totalCost);

        realization.payments.forEach((payment) => {
          const paidAtRaw = (payment as any).paymentDate || payment.createdAt;
          const paidAt = new Date(paidAtRaw);
          if (paidAt <= periodEnd) {
            realizationPaid += Number(payment.amount);
          }
        });
      });

      periods.push({
        period: formatLabel(periodStart),
        orders: Math.round(ordersDebt),
        realization: Math.round(realizationTotal - realizationPaid),
      });

      periodStart = nextPeriodStart;
      guard += 1;
    }

    return periods;
  }, [chartOrders, chartRealizations, chartFromDate, chartToDate, chartMode]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Состояние долгов</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 max-w-xs">
            <Input
              value={partnerSearchQuery}
              onChange={(e) => setPartnerSearchQuery(e.target.value)}
              placeholder="Поиск по партнёру..."
            />
          </div>

          <div className="space-y-4">
            {balancesList.length === 0 ? (
              <p className="text-muted-foreground">Все расчёты погашены</p>
            ) : (
              balancesList.map((b) => (
                <div key={b.id} className="border-b last:border-b-0">
                  <p className="font-medium">{b.name}</p>
                  {b.phone && (
                    <p className="text-xs text-muted-foreground">
                      {b.phone}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                    <div>
                      <p className="text-muted-foreground">Обычные заказы:</p>
                      <p className="font-semibold">
                        {b.ordersTotal.toFixed(0)} MDL
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Реализация:</p>
                      <p className="font-semibold">
                        {(b.realizationTotal - b.realizationPaid).toFixed(0)}{' '}
                        MDL
                      </p>
                    </div>
                  </div>
                  <p
                    className={`my-2 font-bold text-lg ${
                      b.balance > 0 ? 'text-destructive' : 'text-green-600'
                    }`}
                  >
                    {b.balance > 0 ? 'Должен:' : 'Избыток:'}{' '}
                    {Math.abs(b.balance).toFixed(0)} MDL
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>График долгов</CardTitle>
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
              <Bar dataKey="orders" fill="#ef4444" name="Обычные заказы" />
              <Bar dataKey="realization" fill="#f97316" name="Реализация" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

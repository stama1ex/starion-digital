'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { filterByDateRange, type DateRange } from '../utils';
import type { AdminOrder, AdminPartner, AdminRealization } from '../types';

interface DebtTrackingProps {
  orders: AdminOrder[];
  realizations: AdminRealization[];
  partners: AdminPartner[];
  dateRange: DateRange;
}

export default function DebtTracking({
  orders,
  realizations,
  partners,
  dateRange,
}: DebtTrackingProps) {
  const filteredOrders = filterByDateRange(orders, dateRange);
  const filteredRealizations = filterByDateRange(realizations, dateRange);

  type Balance = {
    id: number;
    name: string;
    ordersTotal: number;
    realizationTotal: number;
    realizationPaid: number;
    balance: number;
  };

  const balances = new Map<number, Balance>();

  partners.forEach((partner) => {
    balances.set(partner.id, {
      id: partner.id,
      name: partner.name,
      ordersTotal: 0,
      realizationTotal: 0,
      realizationPaid: 0,
      balance: 0,
    });
  });

  filteredOrders.forEach((order) => {
    const existing = balances.get(order.partnerId);
    if (existing) {
      existing.ordersTotal += Number(order.totalPrice);
    }
  });

  filteredRealizations.forEach((real) => {
    const existing = balances.get(real.partnerId);
    if (existing) {
      existing.realizationTotal += Number(real.totalCost);
      existing.realizationPaid += Number(real.paidAmount);
    }
  });

  balances.forEach((b) => {
    b.balance = b.ordersTotal + (b.realizationTotal - b.realizationPaid);
  });

  const balancesList = Array.from(balances.values()).filter(
    (b) => b.balance !== 0
  );

  const realizationsWithDebt = balancesList.filter(
    (b) => b.realizationTotal > 0
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Состояние долгов</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {balancesList.length === 0 ? (
              <p className="text-muted-foreground">Все расчёты погашены</p>
            ) : (
              balancesList.map((b) => (
                <div key={b.id} className="pb-3 border-b last:border-b-0">
                  <p className="font-medium">{b.name}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                    <div>
                      <p className="text-muted-foreground">Обычные заказы:</p>
                      <p className="font-semibold">
                        {b.ordersTotal.toFixed(2)} MDL
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Реализация:</p>
                      <p className="font-semibold">
                        {(b.realizationTotal - b.realizationPaid).toFixed(2)}{' '}
                        MDL
                      </p>
                    </div>
                  </div>
                  <p
                    className={`mt-2 font-bold text-lg ${
                      b.balance > 0 ? 'text-destructive' : 'text-green-600'
                    }`}
                  >
                    {b.balance > 0 ? 'Должен:' : 'Избыток:'}{' '}
                    {Math.abs(b.balance).toFixed(2)} MDL
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Товары на реализации</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {realizationsWithDebt.length === 0 ? (
              <p className="text-muted-foreground">Нет реализаций</p>
            ) : (
              realizationsWithDebt.map((b) => (
                <div key={b.id} className="pb-3 border-b last:border-b-0">
                  <p className="font-medium">{b.name}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                    <div>
                      <p className="text-muted-foreground">Отгружено:</p>
                      <p className="font-semibold">
                        {b.realizationTotal.toFixed(2)} MDL
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Оплачено:</p>
                      <p className="font-semibold">
                        {b.realizationPaid.toFixed(2)} MDL
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 bg-secondary p-2 rounded">
                    <p className="text-sm text-muted-foreground">Осталось:</p>
                    <p
                      className={`${
                        b.realizationTotal - b.realizationPaid !== 0
                          ? 'font-bold text-destructive'
                          : 'font-bold text-green-600'
                      } `}
                    >
                      {(b.realizationTotal - b.realizationPaid).toFixed(2)} MDL
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

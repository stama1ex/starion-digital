/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DebtTrackingProps {
  orders: any[];
  realizations: any[];
  partners: any[];
  dateRange: 'day' | 'week' | 'month';
}

export default function DebtTracking({
  orders,
  realizations,
  partners,
}: DebtTrackingProps) {
  // Вычисляем баланс для каждого контрагента
  const balances = new Map<
    number,
    {
      id: number;
      name: string;
      ordersTotal: number;
      realizationTotal: number;
      realizationPaid: number;
      balance: number; // Положительное = должен нам, отрицательное = мы должны
    }
  >();

  // Инициализируем для всех партнёров
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

  // Суммируем обычные заказы
  orders.forEach((order) => {
    const existing = balances.get(order.partnerId);
    if (existing) {
      existing.ordersTotal += Number(order.totalPrice);
    }
  });

  // Суммируем реализации
  realizations.forEach((real) => {
    const existing = balances.get(real.partnerId);
    if (existing) {
      existing.realizationTotal += Number(real.totalCost);
      existing.realizationPaid += Number(real.paidAmount);
    }
  });

  // Считаем финальный баланс
  balances.forEach((balance) => {
    balance.balance =
      balance.ordersTotal +
      (balance.realizationTotal - balance.realizationPaid);
  });

  const balancesList = Array.from(balances.values()).filter(
    (b) => b.balance !== 0
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Debt Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Состояние Долгов</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {balancesList.length === 0 ? (
              <p className="text-muted-foreground">Все расчёты погашены</p>
            ) : (
              balancesList.map((balance) => (
                <div key={balance.id} className="pb-3 border-b last:border-b-0">
                  <p className="font-medium">{balance.name}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                    <div>
                      <p className="text-muted-foreground">Обычные заказы:</p>
                      <p className="font-semibold">
                        ${balance.ordersTotal.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Реализация:</p>
                      <p className="font-semibold">
                        $
                        {(
                          balance.realizationTotal - balance.realizationPaid
                        ).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`mt-2 font-bold text-lg ${
                      balance.balance > 0 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {balance.balance > 0 ? 'Должен:' : 'Избыток:'} $
                    {Math.abs(balance.balance).toFixed(2)}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Realization Details */}
      <Card>
        <CardHeader>
          <CardTitle>Детали Реализации</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {balancesList.filter((b) => b.realizationTotal > 0).length === 0 ? (
              <p className="text-muted-foreground">Нет реализаций</p>
            ) : (
              balancesList
                .filter((b) => b.realizationTotal > 0)
                .map((balance) => (
                  <div
                    key={balance.id}
                    className="pb-3 border-b last:border-b-0"
                  >
                    <p className="font-medium">{balance.name}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                      <div>
                        <p className="text-muted-foreground">Отгружено:</p>
                        <p className="font-semibold">
                          ${balance.realizationTotal.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Оплачено:</p>
                        <p className="font-semibold">
                          ${balance.realizationPaid.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 bg-secondary p-2 rounded">
                      <p className="text-sm text-muted-foreground">Осталось:</p>
                      <p className="font-bold text-lg">
                        $
                        {(
                          balance.realizationTotal - balance.realizationPaid
                        ).toFixed(2)}
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

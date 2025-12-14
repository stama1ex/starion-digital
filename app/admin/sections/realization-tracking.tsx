'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AdminRealization } from '../types';

interface RealizationTrackingProps {
  realizations: AdminRealization[];
  onRefresh: () => void;
}

const statusClasses: Record<string, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-600',
  PARTIAL: 'bg-blue-500/20 text-blue-600',
  COMPLETED: 'bg-green-500/20 text-green-600',
  CANCELLED: 'bg-red-500/20 text-red-600',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Ожидание',
  PARTIAL: 'Частично',
  COMPLETED: 'Завершено',
  CANCELLED: 'Отменено',
};

export default function RealizationTracking({
  realizations,
  onRefresh,
}: RealizationTrackingProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleAddPayment = async (realizationId: number) => {
    const input = prompt('Введите сумму платежа (MDL):');
    if (!input) return;

    const amount = Number(input);
    if (!Number.isFinite(amount) || amount <= 0) return;

    try {
      const response = await fetch('/api/admin/realization-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realizationId, amount }),
      });

      if (response.ok) {
        onRefresh();
      } else {
        console.error('Payment error', await response.text());
      }
    } catch (error) {
      console.error('Error adding payment:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Товары на реализации</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {realizations.length === 0 ? (
            <p className="text-muted-foreground">Нет товаров на реализации</p>
          ) : (
            realizations.map((realization) => {
              const remaining =
                Number(realization.totalCost) - Number(realization.paidAmount);
              const isExpanded = expandedId === realization.id;

              return (
                <div key={realization.id} className="border rounded-lg p-4">
                  <div
                    className={`flex justify-between items-center ${
                      realization.status !== 'CANCELLED'
                        ? 'cursor-pointer'
                        : 'cursor-not-allowed opacity-60'
                    }`}
                    onClick={() => {
                      if (realization.status !== 'CANCELLED') {
                        setExpandedId(isExpanded ? null : realization.id);
                      }
                    }}
                  >
                    <div className="flex-1">
                      <p className="font-bold">
                        Дилер: {realization.partner.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Заказ #{realization.orderId}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-2 py-1 rounded text-sm font-medium ${
                          statusClasses[realization.status] ?? ''
                        }`}
                      >
                        {statusLabels[realization.status] ?? realization.status}
                      </span>
                      <p className="mt-2 font-bold">
                        Долг: {remaining.toFixed(2)} MDL
                      </p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      <div>
                        <h4 className="font-semibold mb-2">Товары:</h4>
                        <div className="space-y-2">
                          {realization.items.map((item) => (
                            <div
                              key={item.id}
                              className="bg-secondary p-2 rounded text-sm"
                            >
                              <p className="font-medium">
                                {item.product.number} — {item.quantity} шт
                              </p>
                              <p className="text-muted-foreground">
                                Цена: {Number(item.unitPrice).toFixed(2)} ×{' '}
                                {item.quantity} ={' '}
                                {Number(item.totalPrice).toFixed(2)} MDL
                              </p>
                              {/* <p className="text-xs mt-1">
                                Продано: {item.soldQuantity} шт | Оплачено:{' '}
                                {item.paidQuantity} шт
                              </p> */}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Платежи:</h4>
                        <div className="space-y-1">
                          {realization.payments.map((payment) => (
                            <div
                              key={payment.id}
                              className="flex justify-between text-sm p-1 bg-secondary rounded"
                            >
                              <span>
                                {(() => {
                                  const d = new Date(payment.createdAt);
                                  const day = String(d.getDate()).padStart(
                                    2,
                                    '0'
                                  );
                                  const month = String(
                                    d.getMonth() + 1
                                  ).padStart(2, '0');
                                  const year = d.getFullYear();
                                  return `${day}.${month}.${year}`;
                                })()}
                              </span>
                              <span className="font-semibold">
                                {Number(payment.amount).toFixed(2)} MDL
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-secondary p-3 rounded">
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Всего</p>
                            <p className="font-bold">
                              {Number(realization.totalCost).toFixed(2)} MDL
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Оплачено</p>
                            <p className="font-bold">
                              {Number(realization.paidAmount).toFixed(2)} MDL
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Осталось</p>
                            <p
                              className={`${
                                remaining !== 0
                                  ? 'font-bold text-destructive'
                                  : 'font-bold text-green-600'
                              } `}
                            >
                              {remaining.toFixed(2)} MDL
                            </p>
                          </div>
                        </div>
                      </div>

                      {remaining > 0 && realization.status !== 'CANCELLED' && (
                        <Button
                          onClick={() => handleAddPayment(realization.id)}
                          className="w-full"
                        >
                          Добавить платёж
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

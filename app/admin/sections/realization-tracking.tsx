/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RealizationTrackingProps {
  realizations: any[];
}

export default function RealizationTracking({
  realizations,
}: RealizationTrackingProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleAddPayment = async (realizationId: number) => {
    const amount = prompt('Введите сумму платежа (MDL):');
    if (!amount) return;

    try {
      const response = await fetch('/api/admin/realization-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realizationId, amount: parseFloat(amount) }),
      });

      if (response.ok) {
        // Перезагружаем страницу чтобы увидеть обновления
        window.location.reload();
      }
    } catch (error) {
      console.error('Error adding payment:', error);
    }
  };

  const statusColors = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    PARTIAL: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Товары на Реализации</CardTitle>
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
                    className="cursor-pointer flex justify-between items-center"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : realization.id)
                    }
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
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          statusColors[
                            realization.status as keyof typeof statusColors
                          ]
                        }`}
                      >
                        {realization.status}
                      </span>
                      <p className="mt-2 font-bold">
                        Долг: ${remaining.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      {/* Items */}
                      <div>
                        <h4 className="font-semibold mb-2">Товары:</h4>
                        <div className="space-y-2">
                          {realization.items.map((item: any) => (
                            <div
                              key={item.id}
                              className="bg-secondary p-2 rounded text-sm"
                            >
                              <p className="font-medium">
                                {item.product.number} - {item.quantity} шт
                              </p>
                              <p className="text-muted-foreground">
                                Цена: ${item.unitPrice} × {item.quantity} = $
                                {item.totalPrice.toFixed(2)}
                              </p>
                              <p className="text-xs mt-1">
                                Продано: {item.soldQuantity} шт | Оплачено:{' '}
                                {item.paidQuantity} шт
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Payments */}
                      <div>
                        <h4 className="font-semibold mb-2">Платежи:</h4>
                        <div className="space-y-1">
                          {realization.payments.map((payment: any) => (
                            <div
                              key={payment.id}
                              className="flex justify-between text-sm p-1 bg-secondary rounded"
                            >
                              <span>
                                {new Date(
                                  payment.createdAt
                                ).toLocaleDateString()}
                              </span>
                              <span className="font-semibold">
                                ${Number(payment.amount).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="bg-secondary p-3 rounded">
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Всего</p>
                            <p className="font-bold">
                              ${Number(realization.totalCost).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Оплачено</p>
                            <p className="font-bold">
                              ${Number(realization.paidAmount).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Осталось</p>
                            <p className="font-bold text-red-600">
                              ${remaining.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Add Payment Button */}
                      {remaining > 0 && (
                        <Button
                          onClick={() => handleAddPayment(realization.id)}
                          className="w-full"
                        >
                          Добавить Платёж
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

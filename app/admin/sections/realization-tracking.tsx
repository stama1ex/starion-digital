'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Pencil, Trash2 } from 'lucide-react';
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
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isEditPaymentDialogOpen, setIsEditPaymentDialogOpen] = useState(false);
  const [currentRealizationId, setCurrentRealizationId] = useState<
    number | null
  >(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const handleOpenPaymentDialog = (realizationId: number) => {
    setCurrentRealizationId(realizationId);
    setPaymentAmount('');
    setPaymentNotes('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setIsPaymentDialogOpen(true);
  };

  const handleOpenEditPaymentDialog = (
    paymentId: number,
    amount: number,
    notes: string | null,
    date: string
  ) => {
    setCurrentPaymentId(paymentId);
    setPaymentAmount(amount.toString());
    setPaymentNotes(notes || '');
    setPaymentDate(new Date(date).toISOString().split('T')[0]);
    setIsEditPaymentDialogOpen(true);
  };

  const handleAddPayment = async () => {
    if (!currentRealizationId) return;

    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Введите корректную сумму');
      return;
    }

    try {
      const response = await fetch('/api/admin/realization-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          realizationId: currentRealizationId,
          amount,
          notes: paymentNotes || undefined,
          paymentDate: paymentDate,
        }),
      });

      if (response.ok) {
        setIsPaymentDialogOpen(false);
        onRefresh();
      } else {
        const error = await response.text();
        toast.error(`Ошибка: ${error}`);
      }
    } catch (error) {
      console.error('Error adding payment:', error);
      toast.error('Ошибка при добавлении платежа');
    }
  };

  const handleUpdatePayment = async () => {
    if (!currentPaymentId) return;

    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Введите корректную сумму');
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/realization-payment/${currentPaymentId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            notes: paymentNotes || undefined,
            paymentDate: paymentDate,
          }),
        }
      );

      if (response.ok) {
        setIsEditPaymentDialogOpen(false);
        onRefresh();
      } else {
        const error = await response.text();
        toast.error(`Ошибка: ${error}`);
      }
    } catch (error) {
      console.error('Error updating payment:', error);
      toast.error('Ошибка при обновлении платежа');
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот платёж?')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/realization-payment/${paymentId}`,
        {
          method: 'DELETE',
        }
      );

      if (response.ok) {
        onRefresh();
      } else {
        const error = await response.text();
        toast.error(`Ошибка: ${error}`);
      }
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast.error('Ошибка при удалении платежа');
    }
  };

  return (
    <>
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
                  Number(realization.totalCost) -
                  Number(realization.paidAmount);
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
                          {statusLabels[realization.status] ??
                            realization.status}
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
                                className="flex justify-between items-center text-sm p-2 bg-secondary rounded"
                              >
                                <div className="flex-1">
                                  <span className="font-medium">
                                    {(() => {
                                      const d = new Date(
                                        payment.paymentDate || payment.createdAt
                                      );
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
                                  <span className="ml-2 font-semibold">
                                    {Number(payment.amount).toFixed(2)} MDL
                                  </span>
                                  {payment.notes && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {payment.notes}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-1 ml-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditPaymentDialog(
                                        payment.id,
                                        Number(payment.amount),
                                        payment.notes,
                                        (
                                          payment.paymentDate ||
                                          payment.createdAt
                                        ).toString()
                                      );
                                    }}
                                    title="Редактировать платёж"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeletePayment(payment.id);
                                    }}
                                    title="Удалить платёж"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
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

                        {remaining > 0 &&
                          realization.status !== 'CANCELLED' && (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPaymentDialog(realization.id);
                              }}
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

      {/* Add Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить платёж</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="payment-amount">Сумма (MDL)</Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Введите сумму"
              />
            </div>
            <div>
              <Label htmlFor="payment-date">Дата платежа</Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="payment-notes">Примечание (необязательно)</Label>
              <Input
                id="payment-notes"
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Комментарий к платежу"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsPaymentDialogOpen(false)}
              >
                Отмена
              </Button>
              <Button onClick={handleAddPayment}>Добавить</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog
        open={isEditPaymentDialogOpen}
        onOpenChange={setIsEditPaymentDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать платёж</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-payment-amount">Сумма (MDL)</Label>
              <Input
                id="edit-payment-amount"
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Введите сумму"
              />
            </div>
            <div>
              <Label htmlFor="edit-payment-date">Дата платежа</Label>
              <Input
                id="edit-payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-payment-notes">
                Примечание (необязательно)
              </Label>
              <Input
                id="edit-payment-notes"
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Комментарий к платежу"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditPaymentDialogOpen(false)}
              >
                Отмена
              </Button>
              <Button onClick={handleUpdatePayment}>Сохранить</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

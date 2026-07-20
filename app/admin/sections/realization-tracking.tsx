'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { ChevronDown, ChevronUp, CreditCard, History } from 'lucide-react';
import type { AdminRealization } from '../types';

interface RealizationTrackingProps {
  realizations: AdminRealization[];
  onRefresh: () => void;
}

type PartnerRealizationGroup = {
  partnerId: number;
  partnerName: string;
  realizations: AdminRealization[];
  totalCost: number;
  paidAmount: number;
  debt: number;
  activeCount: number;
  completedCount: number;
  lastActivityAt: string;
};

const statusClasses: Record<string, string> = {
  PENDING: 'bg-yellow-500',
  PARTIAL: 'bg-blue-500',
  COMPLETED: 'bg-green-500',
  CANCELLED: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Ожидание оплаты',
  PARTIAL: 'Частично оплачен',
  COMPLETED: 'Оплачен',
  CANCELLED: 'Отменено',
};

function formatMoney(value: number) {
  return `${value.toFixed(2)} MDL`;
}

function buildPartnerGroups(realizations: AdminRealization[]) {
  const groups = new Map<number, PartnerRealizationGroup>();

  for (const realization of realizations) {
    const partnerId = realization.partner.id;
    const current = groups.get(partnerId);
    const createdAt = new Date(realization.createdAt);

    if (!current) {
      groups.set(partnerId, {
        partnerId,
        partnerName: realization.partner.name,
        realizations: [realization],
        totalCost:
          realization.status === 'CANCELLED'
            ? 0
            : Number(realization.totalCost),
        paidAmount:
          realization.status === 'CANCELLED'
            ? 0
            : Number(realization.paidAmount),
        debt:
          realization.status === 'CANCELLED'
            ? 0
            : Number(realization.totalCost) - Number(realization.paidAmount),
        activeCount: realization.status === 'CANCELLED' ? 0 : 1,
        completedCount: realization.status === 'COMPLETED' ? 1 : 0,
        lastActivityAt: createdAt.toISOString(),
      });
      continue;
    }

    current.realizations.push(realization);
    if (createdAt.getTime() > new Date(current.lastActivityAt).getTime()) {
      current.lastActivityAt = createdAt.toISOString();
    }

    if (realization.status !== 'CANCELLED') {
      current.totalCost += Number(realization.totalCost);
      current.paidAmount += Number(realization.paidAmount);
      current.debt +=
        Number(realization.totalCost) - Number(realization.paidAmount);
      current.activeCount += 1;
    }

    if (realization.status === 'COMPLETED') {
      current.completedCount += 1;
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      debt: Math.max(group.debt, 0),
      realizations: group.realizations.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    }))
    .sort(
      (a, b) =>
        new Date(b.lastActivityAt).getTime() -
        new Date(a.lastActivityAt).getTime(),
    );
}

export default function RealizationTracking({
  realizations,
  onRefresh,
}: RealizationTrackingProps) {
  const [partnerSearchQuery, setPartnerSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DEBT' | 'CLOSED'>(
    'ALL',
  );
  const [expandedPartnerId, setExpandedPartnerId] = useState<number | null>(
    null,
  );
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [currentPartnerId, setCurrentPartnerId] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [historyPartnerId, setHistoryPartnerId] = useState<number | null>(
    null,
  );

  const partnerGroups = useMemo(
    () => buildPartnerGroups(realizations),
    [realizations],
  );

  const visiblePartners = partnerGroups
    .filter((group) =>
      group.partnerName
        .toLowerCase()
        .includes(partnerSearchQuery.toLowerCase()),
    )
    .filter((group) => {
      if (statusFilter === 'DEBT') return group.debt > 0;
      if (statusFilter === 'CLOSED') return group.debt <= 0;
      return true;
    });

  const formatDate = (value: string | Date | null | undefined) => {
    const date = new Date(value ?? NaN);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  // paymentDate хранит только дату (выбирается в date-picker'e и всегда
  // сохраняется как UTC-полночь) - точное время операции берём из createdAt
  const formatTimeOnly = (value: string | Date | null | undefined) => {
    const date = new Date(value ?? NaN);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const historyGroup = partnerGroups.find(
    (group) => group.partnerId === historyPartnerId,
  );

  const historyPayments = (historyGroup?.realizations ?? [])
    .flatMap((realization) =>
      realization.payments.map((payment) => ({
        ...payment,
        realizationId: realization.id,
      })),
    )
    .sort(
      (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime(),
    );

  const handleOpenHistoryDialog = (partnerId: number) => {
    setHistoryPartnerId(partnerId);
    setIsHistoryDialogOpen(true);
  };

  const handleOpenPaymentDialog = (partnerId: number) => {
    setCurrentPartnerId(partnerId);
    setPaymentAmount('');
    setPaymentNotes('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setIsPaymentDialogOpen(true);
  };

  const handleAddPayment = async () => {
    if (!currentPartnerId) return;

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
          partnerId: currentPartnerId,
          amount,
          notes: paymentNotes || undefined,
          paymentDate,
        }),
      });

      if (response.ok) {
        setIsPaymentDialogOpen(false);
        onRefresh();
        return;
      }

      const error = await response.text();
      toast.error(`Ошибка: ${error}`);
    } catch (error) {
      console.error('Error adding partner payment:', error);
      toast.error('Ошибка при добавлении платежа');
    }
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Реализации по партнёрам</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Платёж распределяется автоматически по задолженности партнёра, без
              ручной привязки к конкретной реализации.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <Input
              value={partnerSearchQuery}
              onChange={(e) => setPartnerSearchQuery(e.target.value)}
              placeholder="Поиск по партнёру..."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={statusFilter === 'ALL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('ALL')}
            >
              Все
            </Button>
            <Button
              type="button"
              variant={statusFilter === 'DEBT' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('DEBT')}
            >
              Есть долг
            </Button>
            <Button
              type="button"
              variant={statusFilter === 'CLOSED' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('CLOSED')}
            >
              Закрыт
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {visiblePartners.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">
                  Нет реализаций для отображения
                </p>
              </CardContent>
            </Card>
          ) : (
            visiblePartners.map((group) => {
              const isExpanded = expandedPartnerId === group.partnerId;

              return (
                <Card
                  key={group.partnerId}
                  className="overflow-hidden py-1 transition-colors hover:bg-secondary/40 cursor-pointer"
                >
                  <CardContent>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 text-left cursor-pointer"
                      onClick={() =>
                        setExpandedPartnerId(
                          isExpanded ? null : group.partnerId,
                        )
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">
                            {group.partnerName}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {group.activeCount} реализац.
                          </Badge>
                          {group.debt > 0 ? (
                            <Badge className="bg-red-500 text-xs">
                              Есть долг
                            </Badge>
                          ) : (
                            <Badge className="bg-green-600 text-xs">
                              Баланс закрыт
                            </Badge>
                          )}
                        </div>
                        <p className="mt-2 truncate text-xs text-muted-foreground">
                          Последняя активность:{' '}
                          {formatDate(group.lastActivityAt)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-center gap-3 md:flex-row md:gap-6">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">
                            Долг по реализациям
                          </p>
                          <p className="font-semibold">
                            {formatMoney(group.debt)}
                          </p>
                        </div>

                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">
                            Оплачено
                          </p>
                          <p className="font-semibold">
                            {formatMoney(group.paidAmount)}
                          </p>
                        </div>

                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Всего</p>
                          <p className="font-semibold">
                            {formatMoney(group.totalCost)}
                          </p>
                        </div>

                        <div className="shrink-0">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-4 space-y-3 border-t pt-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-medium">
                              Реализации партнёра
                            </h4>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Здесь показана история отгрузок, а общий платёж
                              учитывается на уровне партнёра.
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenHistoryDialog(group.partnerId);
                              }}
                            >
                              <History className="mr-2 h-4 w-4" />
                              История платежей
                            </Button>

                            {group.debt > 0 && (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenPaymentDialog(group.partnerId);
                                }}
                              >
                                <CreditCard className="mr-2 h-4 w-4" />
                                Добавить платёж
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {group.realizations.map((realization) => {
                            const totalItems = realization.items.reduce(
                              (sum, item) => sum + item.quantity,
                              0,
                            );

                            return (
                              <div
                                key={realization.id}
                                className="rounded-lg border bg-background/60 p-3"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-medium">
                                        Реализация #{realization.id}
                                      </span>
                                      <Badge
                                        className={`text-xs ${
                                          statusClasses[realization.status] ??
                                          ''
                                        }`}
                                      >
                                        {statusLabels[realization.status] ??
                                          realization.status}
                                      </Badge>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {formatDate(realization.createdAt)} •{' '}
                                      {totalItems} шт
                                    </p>
                                  </div>

                                  <div className="grid w-full grid-cols-2 gap-3 text-sm sm:w-auto sm:min-w-64">
                                    <div>
                                      <p className="text-muted-foreground">
                                        Всего
                                      </p>
                                      <p className="font-semibold">
                                        {formatMoney(
                                          Number(realization.totalCost),
                                        )}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">
                                        Оплачено
                                      </p>
                                      <p className="font-semibold">
                                        {formatMoney(
                                          Number(realization.paidAmount),
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить платёж по партнёру</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="paymentAmount">Сумма</Label>
              <Input
                id="paymentAmount"
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDate">Дата платежа</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentNotes">Примечание</Label>
              <Input
                id="paymentNotes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Например: частичное погашение долга"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Платёж будет автоматически распределён по активным реализациям
              партнёра, начиная с самых старых.
            </p>

            <div className="flex justify-end gap-2 pt-2">
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

      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-h-[80vh] max-w-lg flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              История платежей{' '}
              {historyGroup ? `— ${historyGroup.partnerName}` : ''}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {historyPayments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Платежей ещё не было
              </p>
            ) : (
              historyPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-lg border bg-background/60 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {formatMoney(Number(payment.amount))}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(payment.paymentDate)},{' '}
                        {formatTimeOnly(payment.createdAt)} • Реализация #
                        {payment.realizationId}
                      </p>
                    </div>
                  </div>
                  {payment.notes && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {payment.notes}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          {historyGroup && (
            <div className="flex justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">Всего оплачено</span>
              <span className="font-semibold">
                {formatMoney(historyGroup.paidAmount)}
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

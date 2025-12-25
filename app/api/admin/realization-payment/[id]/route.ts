import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

interface UpdatePaymentBody {
  amount?: number;
  notes?: string;
  paymentDate?: string;
}

async function checkAdminAuth() {
  const session = (await cookies()).get('session')?.value;
  if (!session) return null;

  const partnerId = Number(session);
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
  });

  if (!partner || partner.name !== 'ADMIN') return null;
  return partner;
}

// Обновить платёж
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return new Response('Unauthorized - Admin only', { status: 401 });
    }

    const { id } = await context.params;
    const paymentId = parseInt(id);

    if (!paymentId || isNaN(paymentId)) {
      return new Response('Invalid payment ID', { status: 400 });
    }

    const body = (await req.json()) as UpdatePaymentBody;
    const { amount, notes, paymentDate } = body;

    // Получаем текущий платёж
    const payment = await prisma.realizationPayment.findUnique({
      where: { id: paymentId },
      include: { realization: true },
    });

    if (!payment) {
      return new Response('Payment not found', { status: 404 });
    }

    const oldAmount = Number(payment.amount);
    const newAmount = amount !== undefined ? amount : Number(payment.amount);

    if (newAmount <= 0) {
      return new Response('Amount must be positive', { status: 400 });
    }

    // Проверяем, не превысит ли новая сумма totalCost
    const realization = payment.realization;
    const otherPaymentsSum = Number(realization.paidAmount) - oldAmount;
    const newTotalPaid = otherPaymentsSum + newAmount;

    if (newTotalPaid > Number(realization.totalCost)) {
      return new Response('Payment exceeds remaining amount', { status: 400 });
    }

    // Обновляем платёж
    const updatedPayment = await prisma.realizationPayment.update({
      where: { id: paymentId },
      data: {
        ...(amount !== undefined && { amount: newAmount }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(paymentDate !== undefined && {
          paymentDate: new Date(paymentDate),
        }),
      },
    });

    // Пересчитываем статус реализации
    const newStatus =
      newTotalPaid >= Number(realization.totalCost)
        ? 'COMPLETED'
        : newTotalPaid > 0
        ? 'PARTIAL'
        : 'PENDING';

    await prisma.realization.update({
      where: { id: realization.id },
      data: {
        paidAmount: newTotalPaid,
        status: newStatus,
      },
    });

    // Обновляем статус заказа
    if (newStatus === 'COMPLETED') {
      await prisma.order.update({
        where: { id: realization.orderId },
        data: { status: 'PAID' },
      });
    } else if (oldAmount !== newAmount) {
      // Если раньше было COMPLETED, но теперь нет, обновляем статус заказа
      const oldTotalPaid = otherPaymentsSum + oldAmount;
      const wasCompleted = oldTotalPaid >= Number(realization.totalCost);

      if (wasCompleted) {
        // Раньше реализация была полностью оплачена, теперь - нет
        await prisma.order.update({
          where: { id: realization.orderId },
          data: { status: 'CONFIRMED' },
        });
      }
    }

    return Response.json({ ok: true, payment: updatedPayment });
  } catch (error) {
    const err = error as Error;
    console.error('Update payment error:', err);
    return new Response(err.message ?? 'Error', { status: 500 });
  }
}

// Удалить платёж
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return new Response('Unauthorized - Admin only', { status: 401 });
    }

    const { id } = await context.params;
    const paymentId = parseInt(id);

    if (!paymentId || isNaN(paymentId)) {
      return new Response('Invalid payment ID', { status: 400 });
    }

    // Получаем платёж с реализацией
    const payment = await prisma.realizationPayment.findUnique({
      where: { id: paymentId },
      include: { realization: true },
    });

    if (!payment) {
      return new Response('Payment not found', { status: 404 });
    }

    const realization = payment.realization;
    const oldPaidAmount = Number(realization.paidAmount);
    const paymentAmount = Number(payment.amount);
    const newPaidAmount = oldPaidAmount - paymentAmount;

    // Удаляем платёж
    await prisma.realizationPayment.delete({
      where: { id: paymentId },
    });

    // Пересчитываем статус реализации
    const newStatus =
      newPaidAmount >= Number(realization.totalCost)
        ? 'COMPLETED'
        : newPaidAmount > 0
        ? 'PARTIAL'
        : 'PENDING';

    await prisma.realization.update({
      where: { id: realization.id },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
      },
    });

    // Обновляем статус заказа, если нужно
    if (
      oldPaidAmount >= Number(realization.totalCost) &&
      newPaidAmount < Number(realization.totalCost)
    ) {
      await prisma.order.update({
        where: { id: realization.orderId },
        data: { status: 'CONFIRMED' },
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    const err = error as Error;
    console.error('Delete payment error:', err);
    return new Response(err.message ?? 'Error', { status: 500 });
  }
}

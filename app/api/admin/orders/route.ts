import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAdminAuth, checkSuperAdminAuth } from '../auth-utils';
import { toPlain } from '@/lib/toPlain';
import { applyRealizationConfirmSideEffect } from '@/lib/orders/status';

// GET - получить все заказы
export async function GET() {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const ordersRaw = await prisma.order.findMany({
      include: {
        partner: true,
        createdBy: { select: { id: true, name: true, role: true } },
        items: { include: { product: true } },
        changeLogs: {
          orderBy: { createdAt: 'desc' },
          include: {
            changedBy: { select: { id: true, name: true, role: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      where: {
        partner: { role: 'PARTNER' },
        deletedAt: null,
      },
    });

    const orders = toPlain(ordersRaw);

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// PUT - обновить статус заказа
export async function PUT(request: NextRequest) {
  try {
    if (!(await checkSuperAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const { orderId, status } = await request.json();

    if (!orderId || !status) {
      return NextResponse.json(
        { error: 'Order ID and status are required' },
        { status: 400 }
      );
    }

    // Проверяем что статус валидный
    const validStatuses = ['NEW', 'CONFIRMED', 'PAID', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Получаем заказ для проверки
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        realization: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (existingOrder.deletedAt) {
      return NextResponse.json(
        { error: 'Order is in trash - restore it first' },
        { status: 400 },
      );
    }

    // Если это заказ на реализацию и статус меняется на PAID - запрещаем
    if (existingOrder.isRealization && status === 'PAID') {
      return NextResponse.json(
        { error: 'Realization orders cannot be marked as PAID directly' },
        { status: 400 }
      );
    }

    // Обновляем статус заказа
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        partner: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Если это заказ на реализацию и статус CONFIRMED - создаём или восстанавливаем Realization
    if (existingOrder.isRealization && status === 'CONFIRMED') {
      await applyRealizationConfirmSideEffect(
        prisma,
        order,
        existingOrder.realization,
      );
    }

    // Если это заказ на реализацию и статус меняется с CONFIRMED на NEW - удаляем реализацию
    if (
      existingOrder.isRealization &&
      status === 'NEW' &&
      existingOrder.realization &&
      existingOrder.realization.status !== 'CANCELLED'
    ) {
      await prisma.realization.delete({
        where: { id: existingOrder.realization.id },
      });
    }

    // Если это заказ на реализацию и статус CANCELLED - отменяем и Realization
    if (
      existingOrder.isRealization &&
      status === 'CANCELLED' &&
      existingOrder.realization
    ) {
      await prisma.realization.update({
        where: { id: existingOrder.realization.id },
        data: { status: 'CANCELLED' },
      });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json(
      { error: 'Failed to update order status' },
      { status: 500 }
    );
  }
}

// DELETE - переместить заказ в корзину (мягкое удаление, см. /api/admin/orders/trash
// для восстановления/окончательного удаления и /api/cron/purge-trash для автоочистки)
export async function DELETE(request: NextRequest) {
  try {
    if (!(await checkSuperAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: Number(orderId) },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    await prisma.order.update({
      where: { id: Number(orderId) },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json(
      { error: 'Failed to delete order' },
      { status: 500 }
    );
  }
}

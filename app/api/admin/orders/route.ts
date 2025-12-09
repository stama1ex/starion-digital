import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAdminAuth } from '../auth-utils';
import { toPlain } from '@/lib/toPlain';

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
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
      where: {
        partner: { role: 'PARTNER' },
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
    if (!(await checkAdminAuth())) {
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
      if (!existingOrder.realization) {
        // Создаем новую реализацию
        await prisma.realization.create({
          data: {
            orderId: order.id,
            partnerId: order.partnerId,
            totalCost: order.totalPrice,
            items: {
              create: order.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.pricePerItem,
                costPrice: item.product.costPrice,
                totalPrice: item.sum,
              })),
            },
          },
        });
      } else if (existingOrder.realization.status === 'CANCELLED') {
        // Восстанавливаем отмененную реализацию
        await prisma.realization.update({
          where: { id: existingOrder.realization.id },
          data: { status: 'PENDING' },
        });
      }
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

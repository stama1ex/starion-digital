import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAdminAuth } from '../../auth-utils';
import { Prisma } from '@prisma/client';

// PATCH - обновить кастомные цены для заказа
export async function PATCH(request: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { orderId, customPrices } = body;

    if (!orderId || typeof customPrices !== 'object') {
      return NextResponse.json(
        { error: 'Order ID and customPrices are required' },
        { status: 400 }
      );
    }

    // Получаем заказ с товарами
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        partner: {
          include: {
            prices: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Пересчитываем все позиции заказа с учетом новых цен
    const updatedItems = order.items.map((item) => {
      const key = `${item.product.type}-${item.product.groupId}`;

      // Берем кастомную цену если есть, иначе стандартную цену партнера
      let pricePerItem: number;

      if (
        customPrices[key] !== undefined &&
        customPrices[key] !== null &&
        customPrices[key] !== ''
      ) {
        pricePerItem = parseFloat(customPrices[key]);
      } else {
        // Если кастомная цена не задана, берем стандартную цену партнера
        const standardPrice = order.partner.prices.find(
          (p) =>
            p.type === item.product.type && p.groupId === item.product.groupId
        );
        pricePerItem = standardPrice
          ? Number(standardPrice.price)
          : Number(item.pricePerItem);
      }

      const sum = pricePerItem * item.quantity;

      return {
        id: item.id,
        pricePerItem: new Prisma.Decimal(pricePerItem),
        sum: new Prisma.Decimal(sum),
      };
    });

    // Вычисляем новую общую сумму заказа
    const newTotalPrice = updatedItems.reduce(
      (total, item) => total + Number(item.sum),
      0
    );

    // Обновляем заказ в транзакции
    await prisma.$transaction([
      // Обновляем заказ с новыми customPrices и totalPrice
      prisma.order.update({
        where: { id: orderId },
        data: {
          customPrices: customPrices,
          totalPrice: new Prisma.Decimal(newTotalPrice),
        },
      }),
      // Обновляем каждую позицию заказа
      ...updatedItems.map((item) =>
        prisma.orderItem.update({
          where: { id: item.id },
          data: {
            pricePerItem: item.pricePerItem,
            sum: item.sum,
          },
        })
      ),
    ]);

    // Получаем обновленный заказ
    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        partner: true,
      },
    });

    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    console.error('Error updating custom prices:', error);
    return NextResponse.json(
      { error: 'Failed to update custom prices' },
      { status: 500 }
    );
  }
}

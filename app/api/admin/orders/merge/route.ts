import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAdminAuth } from '../../auth-utils';
import { Prisma } from '@prisma/client';
import { toPlain } from '@/lib/toPlain';

// POST - объединить несколько заказов одного партнёра в один
export async function POST(request: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const rawIds = body?.orderIds;

    if (!Array.isArray(rawIds) || rawIds.length < 2) {
      return NextResponse.json(
        { error: 'Нужно выбрать минимум 2 заказа для объединения' },
        { status: 400 },
      );
    }

    const orderIds = Array.from(
      new Set(rawIds.map((id: unknown) => Number(id))),
    ).filter((id) => Number.isInteger(id));

    if (orderIds.length < 2) {
      return NextResponse.json(
        { error: 'Нужно выбрать минимум 2 разных заказа' },
        { status: 400 },
      );
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: {
        items: { include: { product: true } },
        partner: true,
      },
    });

    if (orders.length !== orderIds.length) {
      return NextResponse.json(
        { error: 'Один или несколько заказов не найдены' },
        { status: 404 },
      );
    }

    const partnerId = orders[0].partnerId;
    if (orders.some((o) => o.partnerId !== partnerId)) {
      return NextResponse.json(
        { error: 'Можно объединять только заказы одного и того же партнёра' },
        { status: 400 },
      );
    }

    if (orders.some((o) => o.isRealization)) {
      return NextResponse.json(
        { error: 'Заказы на реализацию нельзя объединять' },
        { status: 400 },
      );
    }

    if (orders.some((o) => o.status === 'PAID' || o.status === 'CANCELLED')) {
      return NextResponse.json(
        {
          error:
            'Можно объединять только новые или подтверждённые заказы (не оплаченные и не отменённые)',
        },
        { status: 400 },
      );
    }

    // Первичный заказ - самый ранний из выбранных (наименьший id), в него сольются остальные
    const sortedOrders = [...orders].sort((a, b) => a.id - b.id);
    const [primaryOrder, ...otherOrders] = sortedOrders;

    // Цены партнёра для пересчёта позиций
    const partnerPrices = await prisma.price.findMany({ where: { partnerId } });

    // Объединяем кастомные цены заказов: приоритет у первичного заказа,
    // остальные лишь дополняют отсутствующие ключи
    const mergedCustomPrices: Record<string, unknown> = {};
    for (const order of [...sortedOrders].reverse()) {
      Object.assign(
        mergedCustomPrices,
        (order.customPrices as Record<string, unknown>) || {},
      );
    }

    // Складываем позиции всех заказов, суммируя количество одинаковых товаров
    const itemsByProduct = new Map<
      number,
      {
        product: (typeof orders)[number]['items'][number]['product'];
        quantity: number;
        originalSum: number;
      }
    >();

    for (const order of sortedOrders) {
      for (const item of order.items) {
        const existing = itemsByProduct.get(item.productId);
        if (existing) {
          existing.quantity += item.quantity;
          existing.originalSum += Number(item.sum);
        } else {
          itemsByProduct.set(item.productId, {
            product: item.product,
            quantity: item.quantity,
            originalSum: Number(item.sum),
          });
        }
      }
    }

    // Пересчитываем цену каждой позиции: кастомная цена > стандартная цена партнёра >
    // (запасной вариант) средняя цена по исходным заказам, если для товара нет прайса
    const mergedItems = Array.from(itemsByProduct.entries()).map(
      ([productId, { product, quantity, originalSum }]) => {
        const key = `${product.type}-${product.groupId}`;
        const customPrice = mergedCustomPrices[key];

        let pricePerItem: number;
        if (
          customPrice !== undefined &&
          customPrice !== null &&
          customPrice !== ''
        ) {
          pricePerItem = parseFloat(String(customPrice));
        } else {
          const standardPrice = partnerPrices.find(
            (p) => p.type === product.type && p.groupId === product.groupId,
          );
          pricePerItem = standardPrice
            ? Number(standardPrice.price)
            : originalSum / quantity;
        }

        const sum = pricePerItem * quantity;

        return { productId, quantity, pricePerItem, sum };
      },
    );

    const totalPrice = mergedItems.reduce((s, i) => s + i.sum, 0);

    // Примечание первичного заказа: помечаем, что заказ объединён, и сохраняем исходные примечания
    const mergeTag = `Объединены заказы №${sortedOrders
      .map((o) => o.id)
      .join(', №')}`;
    const originalNotes = sortedOrders
      .map((o) => o.notes?.trim())
      .filter((n): n is string => Boolean(n));
    const mergedNotes = [mergeTag, ...Array.from(new Set(originalNotes))].join(
      ' | ',
    );

    const mergedAddress =
      primaryOrder.address?.trim() ||
      sortedOrders.map((o) => o.address?.trim()).find((a) => !!a) ||
      null;

    // Если хотя бы один из заказов уже был подтверждён - сохраняем подтверждённый статус
    const mergedStatus = sortedOrders.some((o) => o.status === 'CONFIRMED')
      ? 'CONFIRMED'
      : 'NEW';

    const mergedOrder = await prisma.$transaction(async (trx) => {
      // Полностью пересобираем позиции первичного заказа
      await trx.orderItem.deleteMany({ where: { orderId: primaryOrder.id } });

      const updated = await trx.order.update({
        where: { id: primaryOrder.id },
        data: {
          totalPrice: new Prisma.Decimal(totalPrice),
          status: mergedStatus,
          notes: mergedNotes,
          address: mergedAddress,
          isMerged: true,
          customPrices: mergedCustomPrices as Prisma.InputJsonValue,
          items: {
            create: mergedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              pricePerItem: new Prisma.Decimal(item.pricePerItem),
              sum: new Prisma.Decimal(item.sum),
            })),
          },
        },
        include: {
          partner: true,
          items: { include: { product: true } },
        },
      });

      // Остальные заказы больше не нужны - их товары уже перенесены
      // в первичный заказ, поэтому удаляем их (каскадно удалятся и их позиции)
      await trx.order.deleteMany({
        where: { id: { in: otherOrders.map((o) => o.id) } },
      });

      return updated;
    });

    return NextResponse.json({
      order: toPlain(mergedOrder),
      deletedOrderIds: otherOrders.map((o) => o.id),
    });
  } catch (error) {
    console.error('Error merging orders:', error);
    return NextResponse.json(
      { error: 'Не удалось объединить заказы' },
      { status: 500 },
    );
  }
}

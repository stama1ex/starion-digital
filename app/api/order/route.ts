import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { createOrderExcel } from '@/lib/export/excel';
import { sendOrderExcel } from '@/lib/telegram/sendExcel';
import type { Prisma } from '@prisma/client';

// === GET: список заказов партнёра ===
export async function GET() {
  const session = (await cookies()).get('session')?.value;
  if (!session) return new Response('Unauthorized', { status: 401 });

  const partnerId = Number(session);

  const orders = await prisma.order.findMany({
    where: { partnerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      totalPrice: true,
      createdAt: true,
      status: true,
      items: {
        select: {
          quantity: true,
          sum: true,
          product: {
            select: { number: true, image: true, country: true },
          },
        },
      },
    },
  });

  return Response.json({ orders });
}

// === POST: создание заказа (обычный / реализация) ===
interface CreateOrderBody {
  items: { productId: number; qty: number }[];
  comment?: string;
  orderType?: 'regular' | 'realization';
}

export async function POST(req: Request) {
  try {
    const session = (await cookies()).get('session')?.value;
    if (!session) return new Response('Unauthorized', { status: 401 });

    const partnerId = Number(session);
    if (!partnerId || Number.isNaN(partnerId)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = (await req.json()) as CreateOrderBody;
    const items = body.items;
    const comment = body.comment;
    const orderType: 'regular' | 'realization' =
      body.orderType === 'realization' ? 'realization' : 'regular';

    if (!Array.isArray(items) || items.length === 0) {
      return new Response('Empty order', { status: 400 });
    }

    // --- товары ---
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== items.length) {
      return new Response('Some products not found', { status: 400 });
    }

    // --- цены партнёра ---
    const prices = await prisma.price.findMany({ where: { partnerId } });

    // --- позиции заказа ---
    const dbItems = items.map((i) => {
      const product = products.find((p) => p.id === i.productId);
      if (!product) {
        throw new Error(`Product ${i.productId} not found`);
      }

      const priceEntry = prices.find(
        (p) => p.type === product.type && p.groupId === product.groupId
      );

      if (!priceEntry) {
        throw new Error(
          `Missing price for ${product.type}/${product.groupId || 'no-group'}`
        );
      }

      const qty = Math.max(1, Number(i.qty));
      const price = Number(priceEntry.price);
      const sum = price * qty;

      return {
        productId: product.id,
        quantity: qty,
        pricePerItem: price,
        sum,
      };
    });

    const total = dbItems.reduce((s, i) => s + i.sum, 0);

    // --- транзакция: создаём заказ ---
    const order = await prisma.$transaction(
      async (trx: Prisma.TransactionClient) =>
        trx.order.create({
          data: {
            partnerId,
            totalPrice: total,
            isRealization: orderType === 'realization', // Устанавливаем флаг
            items: { create: dbItems },
          },
          include: {
            partner: true,
            items: { include: { product: true } },
          },
        })
    );

    // --- если это реализация, НЕ создаём Realization сразу ---
    // Realization будет создан только когда админ подтвердит заказ (status = CONFIRMED)

    const typeLabel = orderType === 'realization' ? 'РЕАЛИЗАЦИЯ' : 'ОБЫЧНЫЙ';

    // Формируем текст для caption
    const orderItems = order.items.map((it) => ({
      number: it.product.number,
      qty: it.quantity,
      price: Number(it.pricePerItem),
      sum: Number(it.sum),
    }));

    const itemsText = orderItems
      .map((i) => `• ${i.number}: ${i.qty} шт × ${i.price} = ${i.sum} MDL`)
      .join('\n');

    const captionText =
      `📌 Новый заказ №${order.id}\n\n` +
      `👤 Покупатель: ${order.partner.name}\n` +
      (comment ? `💬 Комментарий: ${comment}\n` : '') +
      `[${typeLabel}]\n\n` +
      `🛒 Состав заказа:\n${itemsText}\n\n` +
      `💰 Итого: ${total} MDL`;

    try {
      const excelBuffer = await createOrderExcel(order);
      await sendOrderExcel(excelBuffer.buffer as ArrayBuffer, captionText);
    } catch (excelError) {
      console.error('Error sending Excel to Telegram:', excelError);
    }

    return Response.json({ ok: true, orderId: order.id });
  } catch (e) {
    const err = e as Error;
    console.error('Order error:', err);
    return new Response(err.message ?? 'Order error', { status: 400 });
  }
}

import { prisma } from '@/lib/db';
import { createOrderExcel } from '@/lib/export/excel';
import { sendOrderExcel } from '@/lib/telegram/sendExcel';
import type { Prisma } from '@prisma/client';
import { getPartnerFromSessionCookie } from '@/lib/auth/session';

// Admin auth check helper
async function checkAdminAuth() {
  return getPartnerFromSessionCookie('ADMIN');
}

interface CreateOrderForPartnerBody {
  partnerId: number;
  items: { productId: number; qty: number }[];
  orderType?: 'regular' | 'realization';
  notes?: string;
  createdAt?: string;
}

function buildCreatedAt(createdAt?: string) {
  if (!createdAt) {
    return undefined;
  }

  const now = new Date();
  const dateOnlyMatch = createdAt.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds(),
    );
  }

  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

export async function POST(req: Request) {
  try {
    // Check admin authentication
    const admin = await checkAdminAuth();
    if (!admin) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = (await req.json()) as CreateOrderForPartnerBody;
    const { partnerId, items, orderType = 'regular', notes, createdAt } = body;
    const createdAtDate = buildCreatedAt(createdAt);

    // Validate input
    if (!partnerId || !Array.isArray(items) || items.length === 0) {
      return new Response('Invalid request', { status: 400 });
    }

    // Check if partner exists
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
    });

    if (!partner || partner.role === 'ADMIN') {
      return new Response('Partner not found', { status: 404 });
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
        (p) => p.type === product.type && p.groupId === product.groupId,
      );

      if (!priceEntry) {
        throw new Error(
          `Missing price for ${product.type}/${
            product.groupId || 'no-group'
          } for partner ${partner.name}`,
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

    // --- транзакция: создаём заказ со статусом CONFIRMED ---
    const order = await prisma.$transaction(
      async (trx: Prisma.TransactionClient) => {
        const createdOrder = await trx.order.create({
          data: {
            partnerId,
            totalPrice: total,
            status: 'CONFIRMED',
            isRealization: orderType === 'realization',
            notes: notes || null,
            createdAt: createdAtDate,
            items: { create: dbItems },
          },
          include: {
            partner: true,
            items: { include: { product: true } },
          },
        });

        // Если это заказ на реализацию, создаём запись Realization
        if (orderType === 'realization') {
          await trx.realization.create({
            data: {
              orderId: createdOrder.id,
              partnerId,
              totalCost: total,
              paidAmount: 0,
              status: 'PENDING',
              items: {
                create: dbItems.map((item) => {
                  const product = products.find((p) => p.id === item.productId);
                  return {
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.pricePerItem,
                    costPrice: product?.costPrice || 0,
                    totalPrice: item.sum,
                  };
                }),
              },
            },
          });
        }

        return createdOrder;
      },
    );

    // --- Telegram notification с Excel ---
    const typeLabel = orderType === 'realization' ? 'РЕАЛИЗАЦИЯ' : 'ОБЫЧНЫЙ';
    const adminNote = `[Создано админом: ${admin.name}]`;

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
      `💬 Комментарий: ${adminNote}\n[${typeLabel}]\n\n` +
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
    console.error('Admin create order error:', err);
    return new Response(err.message ?? 'Order creation error', { status: 400 });
  }
}

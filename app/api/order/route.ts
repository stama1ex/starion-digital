import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { sendToTelegram } from '@/lib/telegram';
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
        (p) => p.type === product.type && p.materialId === product.materialId
      );

      if (!priceEntry) {
        throw new Error(
          `Missing price for ${product.type}/${product.materialId}`
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
            items: { create: dbItems },
          },
          include: {
            partner: true,
            items: { include: { product: true } },
          },
        })
    );

    // --- если это реализация, создаём запись Realization ---
    if (orderType === 'realization') {
      await prisma.realization.create({
        data: {
          orderId: order.id,
          partnerId,
          totalCost: total,
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
    }

    const typeLabel = orderType === 'realization' ? 'РЕАЛИЗАЦИЯ' : 'ОБЫЧНЫЙ';

    await sendToTelegram({
      partner: order.partner.name,
      orderId: order.id,
      total,
      comment: comment ? `${comment}\n[${typeLabel}]` : `[${typeLabel}]`,
      items: order.items.map((it) => ({
        number: it.product.number,
        qty: it.quantity,
        price: Number(it.pricePerItem),
        sum: Number(it.sum),
      })),
    });

    return Response.json({ ok: true, orderId: order.id });
  } catch (e) {
    const err = e as Error;
    console.error('Order error:', err);
    return new Response(err.message ?? 'Order error', { status: 400 });
  }
}

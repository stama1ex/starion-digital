/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { sendToTelegram } from '@/lib/telegram';

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

// === POST: создание заказа ===
export async function POST(req: Request) {
  try {
    const session = (await cookies()).get('session')?.value;
    if (!session) return new Response('Unauthorized', { status: 401 });

    const partnerId = Number(session);
    if (!partnerId || Number.isNaN(partnerId)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const items = body.items as { productId: number; qty: number }[];
    const comment: string | undefined = body.comment;
    const orderType: 'regular' | 'realization' = body.orderType || 'regular';

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
      const product = products.find(
        (p: (typeof products)[number]) => p.id === i.productId
      )!;

      const priceEntry = prices.find(
        (p: (typeof prices)[number]) =>
          p.type === product.type && p.material === product.material
      );

      if (!priceEntry) {
        throw new Error(
          `Missing price for ${product.type}/${product.material}`
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

    // --- транзакция ---
    const order = await prisma.$transaction(async (trx: any) =>
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

    // Если заказ на реализацию - создаём запись реализации
    if (orderType === 'realization') {
      const realizationItems = order.items.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.pricePerItem,
        costPrice: item.product.costPrice || 0,
        totalPrice: item.sum,
      }));

      await prisma.realization.create({
        data: {
          orderId: order.id,
          partnerId,
          totalCost: total,
          items: { create: realizationItems },
        },
      });
    }

    // --- телеграм ---
    await sendToTelegram({
      partner: order.partner.name,
      orderId: order.id,
      total,
      comment: comment
        ? `${comment}\n[${
            orderType === 'realization' ? 'РЕАЛИЗАЦИЯ' : 'ОБЫЧНЫЙ'
          }]`
        : `[${orderType === 'realization' ? 'РЕАЛИЗАЦИЯ' : 'ОБЫЧНЫЙ'}]`,
      items: order.items.map((it: (typeof order.items)[number]) => ({
        number: it.product.number,
        qty: it.quantity,
        price: Number(it.pricePerItem),
        sum: Number(it.sum),
      })),
    });

    return Response.json({ ok: true, orderId: order.id });
  } catch (e: any) {
    console.error('Order error:', e);
    return new Response(e.message ?? 'Order error', { status: 400 });
  }
}

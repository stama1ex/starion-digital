/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { sendToTelegram } from '@/lib/telegram';
import type { Product, Price, Prisma } from '@prisma/client';

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
    // 1) Проверка сессии
    const session = (await cookies()).get('session')?.value;
    if (!session) return new Response('Unauthorized', { status: 401 });

    const partnerId = Number(session);
    if (!partnerId || Number.isNaN(partnerId)) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 2) Считываем тело
    const body = await req.json();
    const items = body.items as { productId: number; qty: number }[];
    const comment: string | undefined = body.comment;

    if (!Array.isArray(items) || items.length === 0) {
      return new Response('Empty order', { status: 400 });
    }

    // 3) Получаем товары
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== items.length) {
      return new Response('Some products not found', { status: 400 });
    }

    // 4) Цены партнёра
    const prices = await prisma.price.findMany({ where: { partnerId } });

    // 5) Формируем позиции заказа
    const dbItems = items.map((i) => {
      const product = products.find((p) => p.id === i.productId) as Product;

      const priceEntry = prices.find(
        (p) => p.type === product.type && p.material === product.material
      ) as Price | undefined;

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

    // 6) Создаём заказ (ТРАНЗАКЦИЯ С ТИПАМИ!!!)
    const order = await prisma.$transaction(
      async (trx: Prisma.TransactionClient) => {
        return trx.order.create({
          data: {
            partnerId,
            totalPrice: total,
            items: { create: dbItems },
          },
          include: {
            partner: true,
            items: { include: { product: true } },
          },
        });
      }
    );

    // 7) Уведомление Telegram
    await sendToTelegram({
      partner: order.partner.name,
      orderId: order.id,
      total,
      comment,
      items: order.items.map((it) => ({
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

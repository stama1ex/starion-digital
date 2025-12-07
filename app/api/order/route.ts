/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';

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

export async function POST(req: Request) {
  try {
    // 1) Проверка партнёра
    const session = (await cookies()).get('session')?.value;
    if (!session) return new Response('Unauthorized', { status: 401 });

    const partnerId = Number(session);
    if (Number.isNaN(partnerId)) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 2) Валидация входящих данных
    const body = await req.json();
    const items = body.items as { productId: number; qty: number }[];

    if (!Array.isArray(items) || items.length === 0) {
      return new Response('Empty order', { status: 400 });
    }

    // 3) Подготавливаем все productId
    const productIds = items.map((i) => i.productId);

    // 4) Запрашиваем все товары разом (один запрос)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== items.length) {
      return new Response('Some products not found', { status: 400 });
    }

    // 5) Запрашиваем все цены сразу
    const prices = await prisma.price.findMany({
      where: { partnerId },
    });

    // 6) Обрабатываем позиции
    const dbItems = items.map((i) => {
      const product = products.find((p) => p.id === i.productId)!;
      const foundPrice = prices.find(
        (p) => p.type === product.type && p.material === product.material
      );

      if (!foundPrice) {
        throw new Error(
          `Missing price for ${product.type}/${product.material}`
        );
      }

      const qty = Math.max(1, Number(i.qty)); // защита от qty < 1
      const price = Number(foundPrice.price);
      const sum = price * qty;

      return {
        productId: product.id,
        quantity: qty,
        pricePerItem: price,
        sum,
      };
    });

    const total = dbItems.reduce((s, i) => s + i.sum, 0);

    // 7) Создаём заказ атомарно (транзакция)
    const order = await prisma.$transaction(async (trx) => {
      return await trx.order.create({
        data: {
          partnerId,
          totalPrice: total,
          items: { create: dbItems },
        },
      });
    });

    return Response.json({ ok: true, orderId: order.id });
  } catch (e: any) {
    console.error(e);
    return new Response(e.message ?? 'Order error', { status: 400 });
  }
}

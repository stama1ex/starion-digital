import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { sendToTelegram } from '@/lib/telegram';
import { createOrderExcel } from '@/lib/export/excel';
import { sendOrderExcel } from '@/lib/telegram/sendExcel';

export async function POST(req: Request) {
  try {
    const session = (await cookies()).get('session')?.value;
    if (!session) return new Response('Unauthorized', { status: 401 });

    const { orderId, comment } = await req.json();
    if (!orderId) return new Response('No orderId', { status: 400 });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        partner: true,
        items: { include: { product: true } },
      },
    });

    if (!order) return new Response('Order not found', { status: 404 });

    // Тип выводится автоматически
    const items = order.items.map((it) => ({
      number: it.product.number,
      qty: it.quantity,
      price: Number(it.pricePerItem),
      sum: Number(it.sum),
    }));

    // 1) Телеграм
    await sendToTelegram({
      partner: order.partner.name,
      orderId: order.id,
      total: Number(order.totalPrice),
      comment,
      items,
    });

    // 2) Excel
    const excelBuffer = await createOrderExcel(order);
    await sendOrderExcel(excelBuffer);

    return Response.json({ ok: true, sent: true });
  } catch (e: unknown) {
    console.error('Notify error:', e);
    const msg = e instanceof Error ? e.message : 'Notify error';
    return new Response(msg, { status: 400 });
  }
}

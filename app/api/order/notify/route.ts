import { prisma } from '@/lib/db';
import { createOrderExcel } from '@/lib/export/excel';
import { sendOrderExcel } from '@/lib/telegram/sendExcel';
import { getPartnerFromSessionCookie } from '@/lib/auth/session';
import { formatMoney, formatMDL } from '@/lib/format-money';

export async function POST(req: Request) {
  try {
    const partner = await getPartnerFromSessionCookie();
    if (!partner) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { orderId, comment } = await req.json();
    if (!orderId) return new Response('No orderId', { status: 400 });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        partner: true,
        items: {
          include: {
            product: { include: { group: true } },
          },
        },
      },
    });

    if (!order) return new Response('Order not found', { status: 404 });

    // >>> Жёсткая типизация, чтобы не возникало "any"
    const items = order.items.map((it: (typeof order.items)[number]) => ({
      number: it.product.number,
      qty: it.quantity,
      price: Number(it.pricePerItem),
      sum: Number(it.sum),
    }));

    // Формируем текст для caption
    const itemsText = items
      .map((i) => `• ${i.number}: ${i.qty} шт × ${formatMoney(i.price)} = ${formatMDL(i.sum)}`)
      .join('\n');

    const captionText =
      `📌 Новый заказ №${order.id}\n\n` +
      `👤 Покупатель: ${order.partner.name}\n` +
      (comment ? `💬 Комментарий: ${comment}\n\n` : `\n`) +
      `🛒 Состав заказа:\n${itemsText}\n\n` +
      `💰 Итого: ${formatMDL(Number(order.totalPrice))}`;

    const excelBuffer = await createOrderExcel(order);

    try {
      await sendOrderExcel(excelBuffer.buffer as ArrayBuffer, captionText);
    } catch (excelError) {
      console.error('Error sending Excel to Telegram:', excelError);
    }

    return Response.json({ ok: true, sent: true });
  } catch (e: unknown) {
    console.error('Notify error:', e);
    return new Response('Notify error', { status: 400 });
  }
}

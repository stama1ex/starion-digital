// app/api/order/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sendToTelegram } from '@/lib/telegram';

interface OrderItem {
  number: string;
  name: string;
  type: string;
  quantity: number;
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // если session — JSON вида {"partnerId":"...","company":"..."}
    let partner: { partnerId?: string; company?: string } = {};
    try {
      partner = JSON.parse(session);
    } catch {
      // если пока там просто строка — оставляем пустым
    }

    const body = await req.json();
    const items: OrderItem[] = body.items || [];
    const comment: string = body.comment || '';

    if (!items.length) {
      return NextResponse.json({ error: 'Empty order' }, { status: 400 });
    }

    const lines = items.map(
      (item, index) =>
        `${index + 1}) ${item.name} (№ ${item.number}, ${item.type}) — ${
          item.quantity
        } шт.`
    );

    const message = [
      '🧾 НОВЫЙ ЗАКАЗ С САЙТА STARION',
      '',
      partner.company
        ? `Компания: ${partner.company}`
        : 'Компания: [не указана]',
      partner.partnerId ? `Партнёр ID: ${partner.partnerId}` : undefined,
      '',
      'Позиции:',
      ...lines,
      comment ? `\nКомментарий: ${comment}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');

    await sendToTelegram(message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Order error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

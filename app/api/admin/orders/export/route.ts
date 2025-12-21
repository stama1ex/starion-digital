import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAdminAuth } from '../../auth-utils';
import { createOrderExcel } from '@/lib/export/excel';

export async function POST(req: NextRequest) {
  try {
    // Проверка авторизации
    if (!(await checkAdminAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Получаем orderId из тела запроса
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Получаем заказ с товарами и партнером
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        partner: {
          select: {
            name: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                number: true,
                country: true,
                type: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Генерируем Excel файл
    const buffer = await createOrderExcel(order);

    // Отправляем файл
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="order-${orderId}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error generating Excel:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

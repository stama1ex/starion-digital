import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAdminAuth } from '../../auth-utils';

// Лёгкий эндпоинт для поллинга: только id/дата последнего заказа,
// без include партнёра/товаров — чтобы не гонять полный список заказов
// каждые несколько секунд только ради проверки "не появилось ли новое".
export async function GET() {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 },
      );
    }

    const latest = await prisma.order.findFirst({
      where: { partner: { role: 'PARTNER' } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({
      latestId: latest?.id ?? null,
      latestCreatedAt: latest?.createdAt ?? null,
    });
  } catch (error) {
    console.error('Error checking for new orders:', error);
    return NextResponse.json(
      { error: 'Failed to check for new orders' },
      { status: 500 },
    );
  }
}

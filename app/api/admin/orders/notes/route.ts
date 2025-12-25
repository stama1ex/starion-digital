import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAdminAuth } from '../../auth-utils';

// PATCH - обновить примечание к заказу
export async function PATCH(req: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId, notes } = await req.json();

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { notes: notes || null },
    });

    return NextResponse.json({ ok: true, order });
  } catch (error) {
    console.error('Error updating order notes:', error);
    return NextResponse.json(
      { error: 'Failed to update notes' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkSuperAdminAuth } from '../../auth-utils';
import { toPlain } from '@/lib/toPlain';

// GET - список заказов в корзине (мягко удалённых)
export async function GET() {
  try {
    if (!(await checkSuperAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 },
      );
    }

    const ordersRaw = await prisma.order.findMany({
      where: { deletedAt: { not: null } },
      include: {
        partner: true,
        createdBy: { select: { id: true, name: true, role: true } },
        items: { include: { product: true } },
      },
      orderBy: { deletedAt: 'desc' },
    });

    return NextResponse.json({ orders: toPlain(ordersRaw) });
  } catch (error) {
    console.error('Error fetching trashed orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trashed orders' },
      { status: 500 },
    );
  }
}

// PATCH - восстановить заказ из корзины
export async function PATCH(request: NextRequest) {
  try {
    if (!(await checkSuperAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 },
      );
    }

    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 },
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: Number(orderId) },
    });

    if (!order || !order.deletedAt) {
      return NextResponse.json(
        { error: 'Order not found in trash' },
        { status: 404 },
      );
    }

    await prisma.order.update({
      where: { id: Number(orderId) },
      data: { deletedAt: null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error restoring order:', error);
    return NextResponse.json(
      { error: 'Failed to restore order' },
      { status: 500 },
    );
  }
}

// DELETE - окончательно удалить заказ из корзины (не дожидаясь недели)
export async function DELETE(request: NextRequest) {
  try {
    if (!(await checkSuperAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 },
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: Number(orderId) },
    });

    if (!order || !order.deletedAt) {
      return NextResponse.json(
        { error: 'Order not found in trash' },
        { status: 404 },
      );
    }

    // Каскадно удалятся items, realization, realizationItems, realizationPayments
    await prisma.order.delete({ where: { id: Number(orderId) } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error permanently deleting order:', error);
    return NextResponse.json(
      { error: 'Failed to permanently delete order' },
      { status: 500 },
    );
  }
}

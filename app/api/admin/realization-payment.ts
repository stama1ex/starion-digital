import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const session = (await cookies()).get('session')?.value;
    if (!session || Number(session) !== 1) {
      return new Response('Unauthorized - Admin only', { status: 401 });
    }

    const { realizationId, amount } = await req.json();

    if (!realizationId || !amount || amount <= 0) {
      return new Response('Invalid request', { status: 400 });
    }

    const realization = await prisma.realization.findUnique({
      where: { id: realizationId },
    });

    if (!realization) {
      return new Response('Realization not found', { status: 404 });
    }

    const remaining =
      Number(realization.totalCost) - Number(realization.paidAmount);
    if (amount > remaining) {
      return new Response('Payment exceeds remaining amount', { status: 400 });
    }

    // Добавляем платёж
    const payment = await prisma.realizationPayment.create({
      data: {
        realizationId,
        amount,
      },
    });

    // Обновляем статус реализации
    const newPaidAmount = Number(realization.paidAmount) + amount;
    const newStatus =
      newPaidAmount >= Number(realization.totalCost)
        ? 'COMPLETED'
        : newPaidAmount > 0
        ? 'PARTIAL'
        : 'PENDING';

    await prisma.realization.update({
      where: { id: realizationId },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
      },
    });
    return new Response(JSON.stringify({ ok: true, payment }), {
      status: 200,
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error:', err);
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}

import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';

interface RealizationPaymentBody {
  realizationId: number;
  amount: number;
}

export async function POST(req: Request) {
  try {
    const session = (await cookies()).get('session')?.value;
    if (!session) {
      return new Response('Unauthorized - Admin only', { status: 401 });
    }

    const partnerId = Number(session);
    const admin = await prisma.partner.findUnique({
      where: { id: partnerId },
    });

    if (!admin || admin.name !== 'ADMIN') {
      return new Response('Unauthorized - Admin only', { status: 401 });
    }

    const body = (await req.json()) as RealizationPaymentBody;
    const { realizationId, amount } = body;

    if (
      !realizationId ||
      !Number.isFinite(amount) ||
      typeof amount !== 'number' ||
      amount <= 0
    ) {
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

    const payment = await prisma.realizationPayment.create({
      data: {
        realizationId,
        amount,
      },
    });

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

    return Response.json({ ok: true, payment });
  } catch (error) {
    const err = error as Error;
    console.error('Realization payment error:', err);
    return new Response(err.message ?? 'Error', { status: 500 });
  }
}

import { prisma } from '@/lib/db';
import { getPartnerFromSessionCookie } from '@/lib/auth/session';

interface RealizationPaymentBody {
  partnerId?: number;
  realizationId?: number;
  amount: number;
  notes?: string;
  paymentDate?: string;
}

export async function POST(req: Request) {
  try {
    const admin = await getPartnerFromSessionCookie('ADMIN');
    if (!admin) {
      return new Response('Unauthorized - Admin only', { status: 401 });
    }

    const body = (await req.json()) as RealizationPaymentBody;
    const { partnerId, realizationId, amount, notes, paymentDate } = body;

    if (
      (!partnerId && !realizationId) ||
      !Number.isFinite(amount) ||
      typeof amount !== 'number' ||
      amount <= 0
    ) {
      return new Response('Invalid request', { status: 400 });
    }

    const parsedPaymentDate = paymentDate ? new Date(paymentDate) : new Date();
    if (Number.isNaN(parsedPaymentDate.getTime())) {
      return new Response('Invalid payment date', { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      let targetPartnerId = partnerId;

      if (!targetPartnerId && realizationId) {
        const realization = await tx.realization.findUnique({
          where: { id: realizationId },
          select: { partnerId: true },
        });

        if (!realization) {
          throw new Error('Realization not found');
        }

        targetPartnerId = realization.partnerId;
      }

      if (!targetPartnerId) {
        throw new Error('Partner not found');
      }

      const partnerRealizations = await tx.realization.findMany({
        where: {
          partnerId: targetPartnerId,
          status: { not: 'CANCELLED' },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          orderId: true,
          totalCost: true,
          paidAmount: true,
        },
      });

      const partnerDebt = partnerRealizations.reduce((sum, realization) => {
        const remaining =
          Number(realization.totalCost) - Number(realization.paidAmount);
        return sum + Math.max(remaining, 0);
      }, 0);

      if (partnerDebt <= 0) {
        throw new Error('No active realization debt for this partner');
      }

      if (amount > partnerDebt) {
        throw new Error('Payment exceeds partner debt');
      }

      let remainingAmount = amount;
      const allocations: Array<{ realizationId: number; amount: number }> = [];

      for (const realization of partnerRealizations) {
        if (remainingAmount <= 0) {
          break;
        }

        const currentPaid = Number(realization.paidAmount);
        const currentTotal = Number(realization.totalCost);
        const currentRemaining = currentTotal - currentPaid;

        if (currentRemaining <= 0) {
          continue;
        }

        const allocatedAmount = Math.min(currentRemaining, remainingAmount);
        const nextPaidAmount = currentPaid + allocatedAmount;
        const nextStatus =
          nextPaidAmount >= currentTotal
            ? 'COMPLETED'
            : nextPaidAmount > 0
              ? 'PARTIAL'
              : 'PENDING';

        await tx.realizationPayment.create({
          data: {
            realizationId: realization.id,
            amount: allocatedAmount,
            notes: notes || null,
            paymentDate: parsedPaymentDate,
          },
        });

        await tx.realization.update({
          where: { id: realization.id },
          data: {
            paidAmount: nextPaidAmount,
            status: nextStatus,
          },
        });

        if (nextStatus === 'COMPLETED') {
          await tx.order.update({
            where: { id: realization.orderId },
            data: { status: 'PAID' },
          });
        }

        allocations.push({
          realizationId: realization.id,
          amount: allocatedAmount,
        });

        remainingAmount -= allocatedAmount;
      }

      return {
        partnerId: targetPartnerId,
        allocations,
      };
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    const err = error as Error;
    console.error('Realization payment error:', err);

    if (
      err.message === 'Realization not found' ||
      err.message === 'Partner not found'
    ) {
      return new Response(err.message, { status: 404 });
    }

    return new Response(err.message ?? 'Error', { status: 400 });
  }
}

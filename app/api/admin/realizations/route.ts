import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAdminAuth } from '../auth-utils';
import { toPlain } from '@/lib/toPlain';

// GET - получить все реализации
export async function GET() {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const realizationsRaw = await prisma.realization.findMany({
      include: {
        partner: true,
        items: { include: { product: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      where: {
        partner: { role: 'PARTNER' },
      },
    });

    const realizations = toPlain(realizationsRaw);

    return NextResponse.json({ realizations });
  } catch (error) {
    console.error('Error fetching realizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch realizations' },
      { status: 500 }
    );
  }
}

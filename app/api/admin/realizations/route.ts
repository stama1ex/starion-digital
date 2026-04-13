import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAdminAuth } from '../auth-utils';
import { toPlain } from '@/lib/toPlain';

// GET - получить реализации (с опциональной пагинацией)
export async function GET(request: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const partnerQuery = searchParams.get('partnerQuery')?.trim() || '';

    const limit = limitParam ? Number(limitParam) : null;
    const offset = offsetParam ? Number(offsetParam) : 0;

    const queryBase = {
      include: {
        partner: true,
        items: { include: { product: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      where: {
        partner: {
          role: 'PARTNER',
          ...(partnerQuery
            ? {
                name: {
                  contains: partnerQuery,
                  mode: 'insensitive' as const,
                },
              }
            : {}),
        },
      },
    } as const;

    if (limit && Number.isFinite(limit) && limit > 0) {
      const safeOffset = Number.isFinite(offset) && offset > 0 ? offset : 0;
      const realizationsRaw = await prisma.realization.findMany({
        ...queryBase,
        skip: safeOffset,
        take: limit + 1,
      });

      const hasMore = realizationsRaw.length > limit;
      const realizations = toPlain(realizationsRaw.slice(0, limit));

      return NextResponse.json({ realizations, hasMore });
    }

    const realizationsRaw = await prisma.realization.findMany(queryBase);
    const realizations = toPlain(realizationsRaw);

    return NextResponse.json({ realizations, hasMore: false });
  } catch (error) {
    console.error('Error fetching realizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch realizations' },
      { status: 500 }
    );
  }
}

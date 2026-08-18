import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkSuperAdminAuth } from '../../auth-utils';

// POST copy all prices from one partner to another.
// Full replace of the target partner's price sheet, not a merge — deletes
// all of its existing Price rows first, then copies over the source
// partner's rows. Since we wipe the target before inserting, the fresh
// copies can't collide with the @@unique([partnerId, type, groupId])
// constraint, so no row-by-row upsert logic is needed.
export async function POST(request: NextRequest) {
  try {
    if (!(await checkSuperAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const data = await request.json();
    const fromPartnerId = data.fromPartnerId;
    const toPartnerId = data.toPartnerId;

    if (typeof fromPartnerId !== 'number' || typeof toPartnerId !== 'number') {
      return NextResponse.json(
        { error: 'fromPartnerId and toPartnerId are required' },
        { status: 400 }
      );
    }

    if (fromPartnerId === toPartnerId) {
      return NextResponse.json(
        { error: 'fromPartnerId and toPartnerId must be different partners' },
        { status: 400 }
      );
    }

    const [fromPartner, toPartner] = await Promise.all([
      prisma.partner.findUnique({ where: { id: fromPartnerId } }),
      prisma.partner.findUnique({ where: { id: toPartnerId } }),
    ]);

    if (!fromPartner || !toPartner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const count = await prisma.$transaction(async (tx) => {
      await tx.price.deleteMany({ where: { partnerId: toPartnerId } });

      const sourcePrices = await tx.price.findMany({
        where: { partnerId: fromPartnerId },
      });

      if (sourcePrices.length === 0) return 0;

      await tx.price.createMany({
        data: sourcePrices.map((p) => ({
          partnerId: toPartnerId,
          type: p.type,
          groupId: p.groupId,
          price: p.price,
        })),
      });

      return sourcePrices.length;
    });

    return NextResponse.json({ ok: true, count });
  } catch (error) {
    console.error('Error copying prices:', error);
    return NextResponse.json(
      { error: 'Failed to copy prices' },
      { status: 500 }
    );
  }
}

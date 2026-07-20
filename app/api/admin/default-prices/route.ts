import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkSuperAdminAuth } from '../auth-utils';

// GET all default prices (шаблон цен для новых партнёров)
export async function GET() {
  try {
    if (!(await checkSuperAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 },
      );
    }

    const prices = await prisma.defaultPrice.findMany({
      include: { group: true },
    });

    return NextResponse.json(prices);
  } catch (error) {
    console.error('Error fetching default prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch default prices' },
      { status: 500 },
    );
  }
}

// POST create or update a default price entry
export async function POST(request: NextRequest) {
  try {
    if (!(await checkSuperAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 },
      );
    }

    const data = await request.json();
    const groupId = data.groupId ?? null;

    // Prisma не принимает null в качестве части составного уникального ключа
    // (type_groupId), поэтому для товаров без группы ищем обычным фильтром
    // и обновляем/создаём по id вместо upsert по составному ключу.
    const existing = await prisma.defaultPrice.findFirst({
      where: { type: data.type, groupId },
    });

    const price = existing
      ? await prisma.defaultPrice.update({
          where: { id: existing.id },
          data: { price: data.price },
        })
      : await prisma.defaultPrice.create({
          data: { type: data.type, groupId, price: data.price },
        });

    return NextResponse.json(price);
  } catch (error) {
    console.error('Error saving default price:', error);
    return NextResponse.json(
      { error: 'Failed to save default price' },
      { status: 500 },
    );
  }
}

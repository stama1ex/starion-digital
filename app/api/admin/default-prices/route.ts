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

    if (data.groupId === undefined || data.groupId === null) {
      return NextResponse.json(
        { error: 'groupId is required' },
        { status: 400 },
      );
    }

    const price = await prisma.defaultPrice.upsert({
      where: {
        type_groupId: {
          type: data.type,
          groupId: data.groupId,
        },
      },
      update: { price: data.price },
      create: {
        type: data.type,
        groupId: data.groupId,
        price: data.price,
      },
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

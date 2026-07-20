import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkSuperAdminAuth } from '../auth-utils';

// GET all prices or specific partner prices
export async function GET(request: NextRequest) {
  try {
    if (!(await checkSuperAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');

    let prices;
    if (partnerId) {
      prices = await prisma.price.findMany({
        where: { partnerId: parseInt(partnerId) },
        include: { group: true },
      });
    } else {
      prices = await prisma.price.findMany({
        include: { group: true },
      });
    }
    return NextResponse.json(prices);
  } catch (error) {
    console.error('Error fetching prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prices' },
      { status: 500 }
    );
  }
}

// POST create or update price
export async function POST(request: NextRequest) {
  try {
    if (!(await checkSuperAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const data = await request.json();
    const groupId = data.groupId || null;

    // Prisma не принимает null в качестве части составного уникального ключа
    // (partnerId_type_groupId), поэтому для товаров без группы ищем обычным
    // фильтром и обновляем/создаём по id.
    const existing = await prisma.price.findFirst({
      where: {
        partnerId: data.partnerId,
        type: data.type,
        groupId,
      },
    });

    let price;
    if (existing) {
      price = await prisma.price.update({
        where: { id: existing.id },
        data: {
          price: data.price,
        },
      });
    } else {
      price = await prisma.price.create({
        data: {
          partnerId: data.partnerId,
          type: data.type,
          groupId,
          price: data.price,
        },
      });
    }
    return NextResponse.json(price);
  } catch (error) {
    console.error('Error saving price:', error);
    return NextResponse.json(
      { error: 'Failed to save price' },
      { status: 500 }
    );
  }
}

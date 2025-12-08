import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAdminAuth } from '../auth-utils';

// GET all prices or specific partner prices
export async function GET(request: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
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
      });
    } else {
      prices = await prisma.price.findMany();
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
    if (!(await checkAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const data = await request.json();

    // Check if price already exists
    const existing = await prisma.price.findUnique({
      where: {
        partnerId_type_materialId: {
          partnerId: data.partnerId,
          type: data.type,
          materialId: data.materialId,
        },
      },
    });

    let price;
    if (existing) {
      price = await prisma.price.update({
        where: {
          partnerId_type_materialId: {
            partnerId: data.partnerId,
            type: data.type,
            materialId: data.materialId,
          },
        },
        data: {
          price: data.price,
        },
      });
    } else {
      price = await prisma.price.create({
        data: {
          partnerId: data.partnerId,
          type: data.type,
          materialId: data.materialId,
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

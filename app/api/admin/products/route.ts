import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET all products
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { number: 'asc' },
    });
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// POST create product
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const product = await prisma.product.create({
      data: {
        number: data.number,
        type: data.type,
        country: data.country,
        image: data.image || 'public/default.avif',
        material: data.material,
        costPrice: data.costPrice,
      },
    });
    return NextResponse.json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}

// PUT update product
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const product = await prisma.product.update({
      where: { id: data.id },
      data: {
        number: data.number,
        type: data.type,
        country: data.country,
        material: data.material,
        costPrice: data.costPrice,
      },
    });
    return NextResponse.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE product
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    // Проверяем есть ли заказы с этим товаром
    const orderItems = await prisma.orderItem.findMany({
      where: { productId: id },
    });

    if (orderItems.length > 0) {
      return NextResponse.json(
        {
          error: `Не удалось удалить товар. Он используется в ${orderItems.length} заказах.`,
        },
        { status: 400 }
      );
    }

    // Проверяем реализации
    const realizationItems = await prisma.realizationItem.findMany({
      where: { productId: id },
    });

    if (realizationItems.length > 0) {
      return NextResponse.json(
        {
          error: `Не удалось удалить товар. Он используется в ${realizationItems.length} реализациях.`,
        },
        { status: 400 }
      );
    }

    await prisma.product.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}

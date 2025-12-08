import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '../auth-utils';

export async function GET() {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const materials = await prisma.materialCatalog.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(materials);
  } catch (error) {
    console.error('Error fetching materials:', error);
    return NextResponse.json(
      { error: 'Failed to fetch materials' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const { name, label } = await request.json();

    if (!name || !label) {
      return NextResponse.json(
        { error: 'Name and label are required' },
        { status: 400 }
      );
    }

    // Check if material with this name already exists
    const existing = await prisma.materialCatalog.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Material with this code already exists' },
        { status: 400 }
      );
    }

    const material = await prisma.materialCatalog.create({
      data: {
        name,
        label,
      },
    });

    return NextResponse.json(material);
  } catch (error) {
    console.error('Error creating material:', error);
    return NextResponse.json(
      { error: 'Failed to create material' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const { id, name, label } = await request.json();

    if (!id || !name || !label) {
      return NextResponse.json(
        { error: 'ID, name and label are required' },
        { status: 400 }
      );
    }

    // Check if another material with this name already exists
    const existing = await prisma.materialCatalog.findFirst({
      where: {
        name,
        id: { not: id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Material with this code already exists' },
        { status: 400 }
      );
    }

    const material = await prisma.materialCatalog.update({
      where: { id },
      data: {
        name,
        label,
      },
    });

    return NextResponse.json(material);
  } catch (error) {
    console.error('Error updating material:', error);
    return NextResponse.json(
      { error: 'Failed to update material' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Check if material is used in products
    const productsCount = await prisma.product.count({
      where: { materialId: id },
    });

    if (productsCount > 0) {
      return NextResponse.json(
        {
          error: `Не удалось удалить материал. Он используется в ${productsCount} товарах.`,
        },
        { status: 400 }
      );
    }

    // Check if material is used in prices
    const pricesCount = await prisma.price.count({
      where: { materialId: id },
    });

    if (pricesCount > 0) {
      return NextResponse.json(
        {
          error: `Не удалось удалить материал. Он используется в ${pricesCount} ценах.`,
        },
        { status: 400 }
      );
    }

    await prisma.materialCatalog.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting material:', error);
    return NextResponse.json(
      { error: 'Failed to delete material' },
      { status: 500 }
    );
  }
}

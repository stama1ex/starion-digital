/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAdminAuth } from '../auth-utils';
import bcrypt from 'bcryptjs';

// GET all partners (без пароля!)
export async function GET() {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const partners = await prisma.partner.findMany({
      select: {
        id: true,
        name: true,
        login: true,
        role: true,
        createdAt: true,
        prices: true,
      },
    });

    return NextResponse.json(partners);
  } catch (error) {
    console.error('Error fetching partners:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partners' },
      { status: 500 }
    );
  }
}

// POST create partner
export async function POST(request: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const data = await request.json();

    if (!data.name || !data.name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!data.login || !data.login.trim()) {
      return NextResponse.json({ error: 'Login is required' }, { status: 400 });
    }

    if (!data.password || data.password.length < 4) {
      return NextResponse.json(
        { error: 'Password must be at least 4 characters' },
        { status: 400 }
      );
    }

    const hashed = await bcrypt.hash(data.password, 10);

    const partner = await prisma.partner.create({
      data: {
        name: data.name,
        login: data.login,
        password: hashed,
        role: data.role ?? 'PARTNER',
      },
      select: {
        id: true,
        name: true,
        login: true,
        role: true,
        createdAt: true,
      },
    });

    // Добавляем дефолтные цены для нового партнёра
    // Получаем ID материалов
    const materials = await prisma.materialCatalog.findMany({
      where: {
        name: { in: ['MARBLE', 'WOOD'] },
      },
    });

    const materialMap = new Map(materials.map((m) => [m.name, m.id]));
    const marbleId = materialMap.get('MARBLE');
    const woodId = materialMap.get('WOOD');

    if (marbleId && woodId) {
      await prisma.price.createMany({
        data: [
          {
            partnerId: partner.id,
            type: 'MAGNET',
            materialId: marbleId,
            price: 20,
          },
          {
            partnerId: partner.id,
            type: 'MAGNET',
            materialId: woodId,
            price: 12,
          },
          {
            partnerId: partner.id,
            type: 'PLATE',
            materialId: marbleId,
            price: 120,
          },
          {
            partnerId: partner.id,
            type: 'PLATE',
            materialId: woodId,
            price: 90,
          },
        ],
      });
    }

    return NextResponse.json(partner);
  } catch (error) {
    console.error('Error creating partner:', error);
    return NextResponse.json(
      { error: 'Failed to create partner' },
      { status: 500 }
    );
  }
}

// PUT update partner
export async function PUT(request: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const data = await request.json();

    const updateData: any = {
      name: data.name,
      login: data.login,
    };

    // Обновлять пароль только если он явно передан
    if (data.password && data.password.length > 0) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    // Менять роль можно, но только если ты уверен – можно вообще убрать это
    if (data.role) {
      updateData.role = data.role;
    }

    const partner = await prisma.partner.update({
      where: { id: data.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        login: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(partner);
  } catch (error) {
    console.error('Error updating partner:', error);
    return NextResponse.json(
      { error: 'Failed to update partner' },
      { status: 500 }
    );
  }
}

// DELETE partner
export async function DELETE(request: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const { id } = await request.json();

    await prisma.partner.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting partner:', error);
    return NextResponse.json(
      { error: 'Failed to delete partner' },
      { status: 500 }
    );
  }
}

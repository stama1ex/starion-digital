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
        { status: 401 },
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
      { status: 500 },
    );
  }
}

// POST create partner
export async function POST(request: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 },
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
        { status: 400 },
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

    // Добавляем цены для нового партнёра, копируя уже существующий прайс-лист.
    // Это защищает от ситуации, когда для новых дилеров забывают вручную добавить
    // отдельные цены, например для открыток.
    const templatePartner = await prisma.partner.findFirst({
      where: {
        role: 'PARTNER',
        id: { not: partner.id },
      },
      orderBy: { id: 'asc' },
      include: {
        prices: true,
      },
    });

    if (templatePartner?.prices.length) {
      await prisma.price.createMany({
        data: templatePartner.prices.map((price) => ({
          partnerId: partner.id,
          type: price.type,
          groupId: price.groupId,
          price: price.price,
        })),
      });
    } else {
      // Фолбэк для пустой базы: создаём базовые цены, если ещё нет шаблона.
      const groups = await prisma.productGroup.findMany({
        where: {
          slug: { in: ['MARBLE', 'WOOD'] },
        },
      });

      const groupMap = new Map(groups.map((g) => [g.slug, g.id]));
      const marbleId = groupMap.get('MARBLE');
      const woodId = groupMap.get('WOOD');

      if (marbleId && woodId) {
        await prisma.price.createMany({
          data: [
            {
              partnerId: partner.id,
              type: 'MAGNET',
              groupId: marbleId,
              price: 20,
            },
            {
              partnerId: partner.id,
              type: 'MAGNET',
              groupId: woodId,
              price: 12,
            },
            {
              partnerId: partner.id,
              type: 'PLATE',
              groupId: marbleId,
              price: 120,
            },
            {
              partnerId: partner.id,
              type: 'PLATE',
              groupId: woodId,
              price: 90,
            },
          ],
        });
      }
    }

    const hasKeychainPrice = await prisma.price.findFirst({
      where: {
        partnerId: partner.id,
        type: 'KEYCHAIN',
        groupId: null,
      },
    });

    if (!hasKeychainPrice) {
      await prisma.price.create({
        data: {
          partnerId: partner.id,
          type: 'KEYCHAIN',
          groupId: null,
          price: 25,
        },
      });
    }

    return NextResponse.json(partner);
  } catch (error: any) {
    console.error('Error creating partner:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Партнер с таким логином уже существует' },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'Failed to create partner' },
      { status: 500 },
    );
  }
}

// PUT update partner
export async function PUT(request: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 },
      );
    }

    const data = await request.json();

    const updateData: any = {};

    if (data.name && data.name.trim()) {
      updateData.name = data.name;
    }

    if (data.login && data.login.trim()) {
      updateData.login = data.login;
    }

    // Обновлять пароль только если он явно передан
    if (data.password && data.password.length > 0) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    // Менять роль можно, но только если ты уверен – можно вообще убрать это
    if (data.role) {
      updateData.role = data.role;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Нет данных для обновления' },
        { status: 400 },
      );
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
  } catch (error: any) {
    console.error('Error updating partner:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Партнер с таким логином уже существует' },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'Failed to update partner' },
      { status: 500 },
    );
  }
}

// DELETE partner
export async function DELETE(request: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');

    if (!idParam) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const id = parseInt(idParam);

    // Проверяем что партнёр не админ
    const partner = await prisma.partner.findUnique({
      where: { id },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    if (partner.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'Cannot delete admin account' },
        { status: 403 },
      );
    }

    // Удаляем связанные цены (Price не имеет onDelete: Cascade)
    await prisma.price.deleteMany({
      where: { partnerId: id },
    });

    // Удаляем партнёра (Order и Realization удалятся каскадно)
    await prisma.partner.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting partner:', error);
    return NextResponse.json(
      { error: 'Failed to delete partner' },
      { status: 500 },
    );
  }
}

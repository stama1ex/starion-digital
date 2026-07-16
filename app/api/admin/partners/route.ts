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
        phone: true,
        address: true,
        email: true,
        emailVerified: true,
        isVip: true,
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

    if (!data.password || data.password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    const hashed = await bcrypt.hash(data.password, 10);

    const partner = await prisma.partner.create({
      data: {
        name: data.name,
        login: data.login,
        password: hashed,
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
        isVip: !!data.isVip,
        role: data.role ?? 'PARTNER',
      },
      select: {
        id: true,
        name: true,
        login: true,
        phone: true,
        address: true,
        isVip: true,
        role: true,
        createdAt: true,
      },
    });

    // Добавляем цены для нового партнёра из шаблона "цены по умолчанию",
    // который админ настраивает на странице управления ценами. Это защищает
    // от ситуации, когда для новых дилеров забывают вручную добавить цены и
    // они не могут оформить заказ из-за отсутствующих цен.
    const defaultPrices = await prisma.defaultPrice.findMany();

    if (defaultPrices.length) {
      await prisma.price.createMany({
        data: defaultPrices.map((dp) => ({
          partnerId: partner.id,
          type: dp.type,
          groupId: dp.groupId,
          price: dp.price,
        })),
      });
    } else {
      // Цены по умолчанию ещё не настроены — копируем прайс-лист у другого
      // партнёра, чтобы у нового партнёра были хоть какие-то цены.
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
      }
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

    // Логин, пароль, телефон, адрес и email — личные данные партнёра, он
    // сам управляет ими в личном кабинете (включая сброс пароля через
    // подтверждение по email). Админ со страницы управления партнёрами
    // может редактировать только отображаемое имя и VIP-статус — это не
    // даёт админу возможности перехватить или подменить учётные данные
    // партнёра.
    const updateData: any = {};

    if (data.name && data.name.trim()) {
      updateData.name = data.name;
    }

    if (data.isVip !== undefined) {
      updateData.isVip = !!data.isVip;
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
        phone: true,
        address: true,
        email: true,
        emailVerified: true,
        isVip: true,
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

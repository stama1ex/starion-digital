import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { checkAdminAuth } from '../auth-utils';

// GET - Получить все заявки
export async function GET() {
  if (!(await checkAdminAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const requests = await prisma.partnershipRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error fetching partnership requests:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении заявок' },
      { status: 500 }
    );
  }
}

// PUT - Одобрить или отклонить заявку
export async function PUT(request: NextRequest) {
  if (!(await checkAdminAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, action } = await request.json();

    if (!id || !action) {
      return NextResponse.json(
        { error: 'Не указан ID заявки или действие' },
        { status: 400 }
      );
    }

    const partnershipRequest = await prisma.partnershipRequest.findUnique({
      where: { id },
    });

    if (!partnershipRequest) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
    }

    if (partnershipRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Заявка уже обработана' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // Проверяем уникальность логина
      const existingPartner = await prisma.partner.findUnique({
        where: { login: partnershipRequest.login },
      });

      if (existingPartner) {
        return NextResponse.json(
          { error: 'Партнер с таким логином уже существует' },
          { status: 400 }
        );
      }

      // Хешируем пароль
      const hashedPassword = await bcrypt.hash(partnershipRequest.password, 10);

      // Создаем партнера
      await prisma.partner.create({
        data: {
          name: partnershipRequest.login,
          login: partnershipRequest.login,
          password: hashedPassword,
          role: 'PARTNER',
        },
      });

      // Обновляем статус заявки
      await prisma.partnershipRequest.update({
        where: { id },
        data: { status: 'APPROVED' },
      });

      return NextResponse.json({
        success: true,
        message: 'Заявка одобрена, партнер создан',
      });
    } else if (action === 'reject') {
      // Отклоняем заявку
      await prisma.partnershipRequest.update({
        where: { id },
        data: { status: 'REJECTED' },
      });

      return NextResponse.json({
        success: true,
        message: 'Заявка отклонена',
      });
    } else {
      return NextResponse.json({ error: 'Неверное действие' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing partnership request:', error);
    return NextResponse.json(
      { error: 'Ошибка при обработке заявки' },
      { status: 500 }
    );
  }
}

// DELETE - Удалить заявку
export async function DELETE(request: NextRequest) {
  if (!(await checkAdminAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Не указан ID заявки' },
        { status: 400 }
      );
    }

    const requestId = parseInt(id);

    // Проверяем существование заявки
    const existingRequest = await prisma.partnershipRequest.findUnique({
      where: { id: requestId },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
    }

    // Удаляем заявку
    await prisma.partnershipRequest.delete({
      where: { id: requestId },
    });

    return NextResponse.json({
      success: true,
      message: 'Заявка удалена',
    });
  } catch (error) {
    console.error('Error deleting partnership request:', error);
    return NextResponse.json(
      { error: 'Ошибка при удалении заявки' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPartnershipRequestToTelegram } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  try {
    const { phone, login, password, message } = await request.json();

    // Получаем IP адрес пользователя
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Проверка лимита заявок с одного IP (максимум 2 в сутки)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentRequestsCount = await prisma.partnershipRequest.count({
      where: {
        ipAddress,
        createdAt: {
          gte: oneDayAgo,
        },
      },
    });

    if (recentRequestsCount >= 2) {
      return NextResponse.json(
        {
          error:
            'Превышен лимит заявок. Можно отправить максимум 2 заявки в сутки',
        },
        { status: 429 }
      );
    }

    // Валидация
    if (!phone || !login || !password) {
      return NextResponse.json(
        { error: 'Заполните все обязательные поля' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Пароль должен содержать минимум 6 символов' },
        { status: 400 }
      );
    }

    // Проверка уникальности логина среди партнеров
    const existingPartner = await prisma.partner.findUnique({
      where: { login },
    });

    if (existingPartner) {
      return NextResponse.json(
        { error: 'Этот логин уже используется' },
        { status: 400 }
      );
    }

    // Проверка существующих незавершенных заявок
    const existingRequest = await prisma.partnershipRequest.findFirst({
      where: {
        login,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: 'Заявка с этим логином уже подана' },
        { status: 400 }
      );
    }

    // Создание заявки
    const partnershipRequest = await prisma.partnershipRequest.create({
      data: {
        phone,
        login,
        password,
        message: message || null,
        ipAddress,
        status: 'PENDING',
      },
    });

    // Отправка уведомления в Telegram
    try {
      await sendPartnershipRequestToTelegram({
        id: partnershipRequest.id,
        phone: partnershipRequest.phone,
        login: partnershipRequest.login,
        message: partnershipRequest.message,
      });
    } catch (telegramError) {
      console.error('Failed to send Telegram notification:', telegramError);
      // Не прерываем выполнение, даже если Telegram не отправился
    }

    return NextResponse.json({
      success: true,
      id: partnershipRequest.id,
    });
  } catch (error) {
    console.error('Error creating partnership request:', error);
    return NextResponse.json(
      { error: 'Ошибка при создании заявки' },
      { status: 500 }
    );
  }
}

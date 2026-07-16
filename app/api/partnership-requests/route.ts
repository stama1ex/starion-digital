import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPartnershipRequestToTelegram } from '@/lib/telegram';
import { verifyEmailTicket } from '@/lib/email/verification';
import { checkPartnershipAvailability } from '@/lib/partnership/check-availability';

export async function POST(request: NextRequest) {
  try {
    const { phone, address, login, password, message, emailToken } =
      await request.json();

    if (!emailToken) {
      return NextResponse.json(
        { error: 'Необходимо подтвердить email' },
        { status: 400 }
      );
    }

    let email: string;
    try {
      email = verifyEmailTicket(emailToken);
    } catch (err) {
      console.error('Email verification failed:', err);
      return NextResponse.json(
        { error: 'Не удалось подтвердить email' },
        { status: 400 }
      );
    }

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

    // Финальная проверка занятости логина/email — на случай гонки, если
    // кто-то занял их уже после пред-проверки на клиенте (см. /check)
    const availabilityError = await checkPartnershipAvailability(login, email);
    if (availabilityError) {
      return NextResponse.json({ error: availabilityError }, { status: 400 });
    }

    // Создание заявки
    const partnershipRequest = await prisma.partnershipRequest.create({
      data: {
        phone,
        email,
        address: address || null,
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
        address: partnershipRequest.address,
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

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { checkAdminAuth } from '../auth-utils';
import { sendEmail } from '@/lib/email/transport';

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

      if (partnershipRequest.email) {
        const existingPartnerByEmail = await prisma.partner.findUnique({
          where: { email: partnershipRequest.email },
        });

        if (existingPartnerByEmail) {
          return NextResponse.json(
            { error: 'Партнер с таким email уже существует' },
            { status: 400 }
          );
        }
      }

      // Хешируем пароль
      const hashedPassword = await bcrypt.hash(partnershipRequest.password, 10);

      // Создаем партнера — email уже подтверждён кодом на этапе заявки
      const newPartner = await prisma.partner.create({
        data: {
          name: partnershipRequest.login,
          login: partnershipRequest.login,
          password: hashedPassword,
          phone: partnershipRequest.phone,
          email: partnershipRequest.email,
          // email подтверждён кодом только для заявок, оформленных уже
          // после введения этой проверки — у старых заявок email может
          // отсутствовать
          emailVerified: !!partnershipRequest.email,
          address: partnershipRequest.address,
          role: 'PARTNER',
        },
      });

      // Применяем цены по умолчанию, чтобы партнёр сразу мог оформлять заказы
      const defaultPrices = await prisma.defaultPrice.findMany();

      if (defaultPrices.length) {
        await prisma.price.createMany({
          data: defaultPrices.map((dp) => ({
            partnerId: newPartner.id,
            type: dp.type,
            groupId: dp.groupId,
            price: dp.price,
          })),
        });
      }

      // Обновляем статус заявки
      await prisma.partnershipRequest.update({
        where: { id },
        data: { status: 'APPROVED' },
      });

      // Уведомляем заявителя на email, если он указан - не прерываем
      // выполнение, если письмо не отправилось (партнёр уже создан)
      if (partnershipRequest.email) {
        try {
          await sendEmail({
            to: partnershipRequest.email,
            subject: 'Заявка на партнёрство одобрена — Starion Digital',
            html: `<p>Здравствуйте!</p><p>Ваша заявка на партнёрство одобрена. Теперь вы можете войти в личный кабинет партнёра, используя логин <b>${partnershipRequest.login}</b> и пароль, указанный при подаче заявки.</p><p>С уважением,<br/>Команда Starion Digital</p>`,
            text: `Здравствуйте!\n\nВаша заявка на партнёрство одобрена. Теперь вы можете войти в личный кабинет партнёра, используя логин "${partnershipRequest.login}" и пароль, указанный при подаче заявки.\n\nС уважением, команда Starion Digital`,
          });
        } catch (emailError) {
          console.error('Failed to send approval email:', emailError);
        }
      }

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

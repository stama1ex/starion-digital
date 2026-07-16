import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getPartnerFromSessionCookie } from '@/lib/auth/session';
import { verifyEmailTicket, normalizeEmail } from '@/lib/email/verification';

// GET — профиль текущего пользователя (партнёр или админ)
export async function GET() {
  const partner = await getPartnerFromSessionCookie();
  if (!partner) {
    return new Response('Unauthorized', { status: 401 });
  }

  return Response.json({
    login: partner.login,
    phone: partner.phone,
    email: partner.email,
    emailVerified: partner.emailVerified,
    address: partner.address,
    role: partner.role,
  });
}

interface UpdateAccountBody {
  currentPassword?: string;
  newLogin?: string;
  newPassword?: string;
  phone?: string;
  address?: string;
  email?: string;
  emailToken?: string; // подтверждение ТЕКУЩЕГО (уже сохранённого) email
  newEmailToken?: string; // подтверждение НОВОГО email — только при смене email
}

// Проверяет билет подтверждения и сверяет с ожидаемым адресом.
// Возвращает null при любой проблеме (нет токена, невалиден, не совпал) —
// вызывающий код сам решает, какое сообщение показать.
function checkEmailToken(
  token: string | undefined,
  expected: string,
): string | null {
  if (!token) return null;
  try {
    const verified = normalizeEmail(verifyEmailTicket(token));
    return verified === expected ? verified : null;
  } catch (err) {
    console.error('Email verification failed:', err);
    return null;
  }
}

// PATCH — обновление логина/пароля/телефона/адреса/email текущего пользователя
export async function PATCH(req: Request) {
  try {
    const partner = await getPartnerFromSessionCookie();
    if (!partner) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = (await req.json()) as UpdateAccountBody;
    const {
      currentPassword,
      newLogin,
      newPassword,
      phone,
      address,
      email,
      emailToken,
      newEmailToken,
    } = body;

    const updateData: {
      login?: string;
      password?: string;
      phone?: string | null;
      email?: string | null;
      emailVerified?: boolean;
      address?: string | null;
    } = {};

    const touchesAccount =
      newLogin !== undefined ||
      newPassword !== undefined ||
      phone !== undefined ||
      address !== undefined ||
      email !== undefined;

    const currentEmail = partner.email ? normalizeEmail(partner.email) : null;
    const emailProvided = email !== undefined;
    const nextEmail = emailProvided
      ? email.trim()
        ? normalizeEmail(email)
        : null
      : currentEmail;
    const emailIsChanging = emailProvided && nextEmail !== currentEmail;

    // Если после этого запроса email остаётся confirmedNextEmail — он
    // считается подтверждённым; иначе (email меняется, но новый ещё не
    // подтверждён) — false, до следующего подтверждения
    let confirmedNextEmail: string | null = null;

    if (touchesAccount) {
      if (currentEmail) {
        // Любое изменение аккаунта (включая смену самого email) требует
        // подтверждения ТЕКУЩЕГО email кодом — это доказывает, что запрос
        // делает настоящий владелец аккаунта, а не тот, кто просто угнал
        // сессию и вписал в поле произвольный чужой адрес
        const confirmedCurrent = checkEmailToken(emailToken, currentEmail);
        if (!confirmedCurrent) {
          return new Response(
            'Подтвердите текущий email кодом из письма, чтобы продолжить',
            { status: 400 },
          );
        }

        if (emailIsChanging && nextEmail) {
          // Смена на другой адрес — дополнительно подтверждаем НОВЫЙ email,
          // чтобы убедиться, что он реально принадлежит и доступен вам
          confirmedNextEmail = checkEmailToken(newEmailToken, nextEmail);
          if (!confirmedNextEmail) {
            return new Response('Подтвердите новый email кодом из письма', {
              status: 400,
            });
          }

          const emailTaken = await prisma.partner.findFirst({
            where: { email: nextEmail, id: { not: partner.id } },
          });
          if (emailTaken) {
            return new Response('Этот email уже используется другим аккаунтом', {
              status: 400,
            });
          }
        } else {
          confirmedNextEmail = confirmedCurrent;
        }
      } else if (emailProvided && nextEmail) {
        // Email ещё не был привязан — подтверждаем только что введённый
        confirmedNextEmail = checkEmailToken(emailToken, nextEmail);
        if (!confirmedNextEmail) {
          return new Response('Подтвердите email кодом из письма', {
            status: 400,
          });
        }

        const emailTaken = await prisma.partner.findFirst({
          where: { email: nextEmail, id: { not: partner.id } },
        });
        if (emailTaken) {
          return new Response('Этот email уже используется другим аккаунтом', {
            status: 400,
          });
        }
      }
    }

    // Логин и пароль — дополнительно требуют текущего пароля
    if (newLogin || newPassword) {
      if (!currentPassword) {
        return new Response('Current password is required', { status: 400 });
      }

      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        partner.password,
      );
      if (!isPasswordValid) {
        return new Response('Invalid current password', { status: 401 });
      }

      if (!partner.email) {
        return new Response(
          'Добавьте email в контактных данных, чтобы изменить логин или пароль',
          { status: 400 },
        );
      }

      if (newLogin) {
        const existing = await prisma.partner.findUnique({
          where: { login: newLogin },
        });
        if (existing && existing.id !== partner.id) {
          return new Response('Login already exists', { status: 400 });
        }
        updateData.login = newLogin;
      }

      if (newPassword) {
        updateData.password = await bcrypt.hash(newPassword, 10);
      }
    }

    if (emailProvided) {
      updateData.email = nextEmail;
      updateData.emailVerified = !!nextEmail && nextEmail === confirmedNextEmail;
    }

    if (phone !== undefined) {
      updateData.phone = phone.trim() || null;
    }

    if (address !== undefined) {
      updateData.address = address.trim() || null;
    }

    if (Object.keys(updateData).length === 0) {
      return new Response('Nothing to update', { status: 400 });
    }

    await prisma.partner.update({
      where: { id: partner.id },
      data: updateData,
    });

    return Response.json({ ok: true });
  } catch (e) {
    const err = e as Error & { code?: string };
    if (err.code === 'P2002') {
      return new Response('Этот логин или email уже используется', {
        status: 400,
      });
    }
    console.error('Update account error:', err);
    return new Response(err.message ?? 'Update error', { status: 400 });
  }
}

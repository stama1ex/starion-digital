import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getPartnerFromSessionCookie } from '@/lib/auth/session';

// GET — профиль текущего пользователя (партнёр или админ)
export async function GET() {
  const partner = await getPartnerFromSessionCookie();
  if (!partner) {
    return new Response('Unauthorized', { status: 401 });
  }

  return Response.json({
    login: partner.login,
    phone: partner.phone,
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
}

// PATCH — обновление логина/пароля/телефона/адреса текущего пользователя
export async function PATCH(req: Request) {
  try {
    const partner = await getPartnerFromSessionCookie();
    if (!partner) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = (await req.json()) as UpdateAccountBody;
    const { currentPassword, newLogin, newPassword, phone, address } = body;

    const updateData: {
      login?: string;
      password?: string;
      phone?: string | null;
      address?: string | null;
    } = {};

    // Логин и пароль — секретные данные, требуют подтверждения текущим паролем
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
    const err = e as Error;
    console.error('Update account error:', err);
    return new Response(err.message ?? 'Update error', { status: 400 });
  }
}

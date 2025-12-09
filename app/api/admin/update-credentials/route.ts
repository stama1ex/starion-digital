import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

async function checkAdminAuth() {
  const session = (await cookies()).get('session')?.value;
  if (!session) return null;

  const partnerId = Number(session);
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
  });

  if (!partner || partner.role !== 'ADMIN') return null;
  return partner;
}

interface UpdateCredentialsBody {
  currentPassword: string;
  newLogin?: string;
  newPassword?: string;
}

export async function POST(req: Request) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = (await req.json()) as UpdateCredentialsBody;
    const { currentPassword, newLogin, newPassword } = body;

    if (!currentPassword) {
      return new Response('Current password is required', { status: 400 });
    }

    // Проверяем текущий пароль
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      admin.password
    );
    if (!isPasswordValid) {
      return new Response('Invalid current password', { status: 401 });
    }

    // Проверяем что хотя бы одно поле для обновления указано
    if (!newLogin && !newPassword) {
      return new Response('Nothing to update', { status: 400 });
    }

    const updateData: { login?: string; password?: string } = {};

    // Обновляем логин если указан
    if (newLogin) {
      // Проверяем уникальность логина
      const existingPartner = await prisma.partner.findUnique({
        where: { login: newLogin },
      });

      if (existingPartner && existingPartner.id !== admin.id) {
        return new Response('Login already exists', { status: 400 });
      }

      updateData.login = newLogin;
    }

    // Обновляем пароль если указан
    if (newPassword) {
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    // Обновляем данные
    await prisma.partner.update({
      where: { id: admin.id },
      data: updateData,
    });

    return Response.json({ ok: true });
  } catch (e) {
    const err = e as Error;
    console.error('Update credentials error:', err);
    return new Response(err.message ?? 'Update error', { status: 400 });
  }
}

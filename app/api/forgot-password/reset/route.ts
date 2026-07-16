import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { verifyEmailTicket, normalizeEmail } from '@/lib/email/verification';
import { revokeAllSessions } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json();
    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Не хватает данных' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Пароль должен содержать минимум 6 символов' },
        { status: 400 },
      );
    }

    let email: string;
    try {
      email = normalizeEmail(verifyEmailTicket(token));
    } catch (err) {
      console.error('Invalid password reset ticket:', err);
      return NextResponse.json(
        { error: 'Код подтверждения истёк, начните сброс пароля заново' },
        { status: 400 },
      );
    }

    const partner = await prisma.partner.findUnique({ where: { email } });
    if (!partner) {
      return NextResponse.json({ error: 'Аккаунт не найден' }, { status: 400 });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.partner.update({
      where: { id: partner.id },
      data: { password: hashed },
    });

    // Разлогиниваем все активные сессии — на случай, если пароль сбрасывали
    // из-за угона аккаунта
    await revokeAllSessions(partner.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in forgot-password/reset:', error);
    return NextResponse.json(
      { error: 'Не удалось сбросить пароль' },
      { status: 500 },
    );
  }
}

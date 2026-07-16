import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { ipAddress } from '@vercel/functions';
import { prisma } from '@/lib/db';
import { sendVerificationCode, normalizeEmail } from '@/lib/email/verification';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '5 m'),
});

export async function POST(request: NextRequest) {
  try {
    const ip = ipAddress(request) ?? 'anonymous';
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: 'Слишком много запросов. Попробуйте позже.' },
        { status: 429 },
      );
    }

    const { identifier } = await request.json();
    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      return NextResponse.json(
        { error: 'Введите логин или email' },
        { status: 400 },
      );
    }

    const trimmed = identifier.trim();
    const partner = await prisma.partner.findFirst({
      where: { OR: [{ login: trimmed }, { email: normalizeEmail(trimmed) }] },
    });

    // Не подтверждаем и не опровергаем существование аккаунта — ответ всегда
    // одинаковый, чтобы нельзя было перебором узнать чужие логины/email
    if (partner?.email) {
      try {
        await sendVerificationCode(partner.email);
      } catch (err) {
        console.error('Error sending forgot-password code:', err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in forgot-password/send:', error);
    return NextResponse.json(
      { error: 'Не удалось отправить код' },
      { status: 500 },
    );
  }
}

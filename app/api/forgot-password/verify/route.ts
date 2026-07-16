import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { ipAddress } from '@vercel/functions';
import { prisma } from '@/lib/db';
import { confirmVerificationCode, normalizeEmail } from '@/lib/email/verification';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 m'),
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

    const { identifier, code } = await request.json();
    if (!identifier || !code) {
      return NextResponse.json(
        { error: 'Укажите логин/email и код' },
        { status: 400 },
      );
    }

    const trimmed = identifier.trim();
    const partner = await prisma.partner.findFirst({
      where: { OR: [{ login: trimmed }, { email: normalizeEmail(trimmed) }] },
    });

    // Единое сообщение об ошибке для всех случаев ниже (аккаунт не найден,
    // код не запрашивался, код истёк, неверный код, превышены попытки) —
    // иначе по разнице текста можно было бы перебором узнать чужие
    // логины/email
    const genericError = NextResponse.json(
      { error: 'Неверный код подтверждения' },
      { status: 400 },
    );

    if (!partner?.email) {
      return genericError;
    }

    try {
      const token = await confirmVerificationCode(partner.email, code);
      return NextResponse.json({ token });
    } catch {
      return genericError;
    }
  } catch (error) {
    console.error('Error in forgot-password/verify:', error);
    return NextResponse.json(
      { error: 'Не удалось подтвердить код' },
      { status: 400 },
    );
  }
}

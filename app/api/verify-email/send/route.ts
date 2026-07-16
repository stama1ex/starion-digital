import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { ipAddress } from '@vercel/functions';
import { sendVerificationCode } from '@/lib/email/verification';

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

    const { email } = await request.json();
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Введите корректный email' },
        { status: 400 },
      );
    }

    await sendVerificationCode(email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error sending verification code:', error);
    return NextResponse.json(
      { error: 'Не удалось отправить код подтверждения' },
      { status: 500 },
    );
  }
}

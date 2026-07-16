import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { ipAddress } from '@vercel/functions';
import { normalizeEmail } from '@/lib/email/verification';
import { checkPartnershipAvailability } from '@/lib/partnership/check-availability';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
});

// Быстрая пред-проверка логина/email перед отправкой кода подтверждения —
// чтобы не отправлять письмо и не заставлять человека вводить код, если
// логин или email уже заняты
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

    const { login, email } = await request.json();
    if (!login || !email) {
      return NextResponse.json(
        { error: 'Укажите логин и email' },
        { status: 400 },
      );
    }

    const error = await checkPartnershipAvailability(
      login,
      normalizeEmail(email),
    );

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error checking partnership availability:', error);
    return NextResponse.json(
      { error: 'Не удалось проверить логин/email' },
      { status: 500 },
    );
  }
}

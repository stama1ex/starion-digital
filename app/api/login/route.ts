import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { ipAddress } from '@vercel/functions';
import {
  createSessionCookies,
  getSessionBindCookieName,
  getSessionCookieName,
  getSessionCookieOptions,
} from '@/lib/auth/session';
import {
  sendVerificationCode,
  confirmVerificationCode,
  normalizeEmail,
} from '@/lib/email/verification';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 m'),
});

export async function POST(req: Request) {
  try {
    const ip = ipAddress(req) ?? 'anonymous';
    const { success } = await ratelimit.limit(ip);

    if (!success) {
      return new Response('Too many requests', { status: 429 });
    }

    const { login, password, code } = await req.json();

    if (!login || !password) {
      return new Response('Missing credentials', { status: 400 });
    }

    // Идентификатор может быть либо логином, либо привязанным email
    const partner = await prisma.partner.findFirst({
      where: {
        OR: [{ login }, { email: normalizeEmail(login) }],
      },
    });

    // Не говорим, существует ли логин/email
    if (!partner) {
      return new Response('Invalid credentials', { status: 401 });
    }

    const ok = await bcrypt.compare(password, partner.password);
    if (!ok) {
      return new Response('Invalid credentials', { status: 401 });
    }

    // Если к аккаунту привязан email — вход требует код подтверждения при
    // каждой попытке, чтобы дополнительно защитить аккаунт
    if (partner.email) {
      if (!code) {
        try {
          await sendVerificationCode(partner.email);
        } catch (err) {
          console.error('Error sending login verification code:', err);
          return errorResponse('Не удалось отправить код подтверждения');
        }
        return Response.json({ requiresEmailVerification: true });
      }

      try {
        await confirmVerificationCode(partner.email, code);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Неверный код подтверждения';
        return errorResponse(message);
      }
    }

    const { sessionToken, sessionBind } = await createSessionCookies(
      partner.id,
      req.headers.get('user-agent'),
    );
    const cookieStore = await cookies();
    const cookieOptions = getSessionCookieOptions();

    cookieStore.set(getSessionCookieName(), sessionToken, cookieOptions);
    cookieStore.set(getSessionBindCookieName(), sessionBind, cookieOptions);

    return Response.json({ ok: true, role: partner.role });
  } catch {
    return new Response('Invalid request', { status: 400 });
  }
}

function errorResponse(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

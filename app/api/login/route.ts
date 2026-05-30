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

    const { login, password } = await req.json();

    if (!login || !password) {
      return new Response('Missing credentials', { status: 400 });
    }

    const partner = await prisma.partner.findUnique({
      where: { login },
    });

    // Не говорим, существует ли логин
    if (!partner) {
      return new Response('Invalid credentials', { status: 401 });
    }

    const ok = await bcrypt.compare(password, partner.password);
    if (!ok) {
      return new Response('Invalid credentials', { status: 401 });
    }

    const { sessionToken, sessionBind } = await createSessionCookies(
      partner.id,
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

import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import {
  createSessionCookies,
  getSessionBindCookieName,
  getSessionCookieName,
  getSessionCookieOptions,
} from '@/lib/auth/session';

export async function POST(req: Request) {
  try {
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

    return Response.json({ ok: true });
  } catch {
    return new Response('Invalid request', { status: 400 });
  }
}

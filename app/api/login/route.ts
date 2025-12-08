import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

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

    // Сохраняем только id в сессии
    (await cookies()).set('session', String(partner.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return Response.json({ ok: true });
  } catch {
    return new Response('Invalid request', { status: 400 });
  }
}

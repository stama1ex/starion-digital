import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const { login, password } = await req.json();

    if (!login || !password) {
      return new Response('Missing credentials', { status: 400 });
    }

    // Ищем партнёра в БД
    const partner = await prisma.partner.findUnique({
      where: { login },
    });

    if (!partner) {
      return new Response('Forbidden', { status: 403 });
    }

    // Проверяем пароль (без хэша)
    if (password !== partner.password) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Создаём cookie
    (await cookies()).set('session', String(partner.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 дней
    });

    return Response.json({ ok: true });
  } catch {
    return new Response('Invalid request', { status: 400 });
  }
}

import { prisma } from '@/lib/db';
import { getPartnerFromSessionCookie } from '@/lib/auth/session';
import { normalizeEmail } from '@/lib/email/verification';

// Быстрая пред-проверка нового логина/email перед отправкой кода
// подтверждения — чтобы не отправлять письмо и не заставлять вводить код,
// если логин или email уже заняты другим аккаунтом
export async function POST(req: Request) {
  const partner = await getPartnerFromSessionCookie();
  if (!partner) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { login, email } = (await req.json()) as {
      login?: string;
      email?: string;
    };

    if (login) {
      const existing = await prisma.partner.findUnique({ where: { login } });
      if (existing && existing.id !== partner.id) {
        return Response.json(
          { error: 'Этот логин уже используется' },
          { status: 400 },
        );
      }
    }

    if (email) {
      const existing = await prisma.partner.findFirst({
        where: { email: normalizeEmail(email), id: { not: partner.id } },
      });
      if (existing) {
        return Response.json(
          { error: 'Этот email уже используется другим аккаунтом' },
          { status: 400 },
        );
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Error checking account availability:', error);
    return Response.json(
      { error: 'Не удалось проверить логин/email' },
      { status: 500 },
    );
  }
}

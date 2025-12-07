import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const { login, password } = await req.json();

    // 1) Базовая проверка
    if (!login || !password) {
      return new Response('Missing credentials', { status: 400 });
    }

    // 2) Читаем список разрешённых логинов из ENV
    let allowed: string[];
    try {
      allowed = JSON.parse(process.env.AUTHORIZED_USERS ?? '[]');
    } catch {
      return new Response('Server configuration error', { status: 500 });
    }

    // 3) Проверяем, что логин есть в списке
    if (!allowed.includes(login)) {
      return new Response('Forbidden', { status: 403 });
    }

    // 4) Читаем пароль из ENV
    // login = "firma1" → ожидаем переменную FIRMA1_PWD
    const key = `${login.toUpperCase()}_PWD`;
    const expectedPassword = process.env[key];

    if (!expectedPassword) {
      return new Response('Password not configured', { status: 500 });
    }

    // 5) Сравниваем простой пароль (без хэшей)
    if (password !== expectedPassword) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 6) Ставим cookie session
    const isProd = process.env.NODE_ENV === 'production';

    (await cookies()).set('session', login, {
      httpOnly: true,
      secure: isProd, // на localhost будет false
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return Response.json({ ok: true });
  } catch {
    return new Response('Invalid request', { status: 400 });
  }
}

import { cookies } from 'next/headers';

export async function POST() {
  (await cookies()).set('session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0, // удаляем
  });

  return Response.json({ ok: true });
}

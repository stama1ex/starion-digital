import { cookies } from 'next/headers';

export async function POST() {
  (await cookies()).set('session', '', { path: '/', maxAge: 0 });
  return Response.json({ ok: true });
}

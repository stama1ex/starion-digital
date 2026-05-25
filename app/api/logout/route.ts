import { cookies } from 'next/headers';
import {
  getClearedSessionCookieOptions,
  getSessionBindCookieName,
  getSessionCookieName,
  revokeSessionByCookies,
} from '@/lib/auth/session';

export async function POST() {
  await revokeSessionByCookies();

  const cookieStore = await cookies();
  const clearedOptions = getClearedSessionCookieOptions();

  cookieStore.set(getSessionCookieName(), '', clearedOptions);
  cookieStore.set(getSessionBindCookieName(), '', clearedOptions);

  return Response.json({ ok: true });
}

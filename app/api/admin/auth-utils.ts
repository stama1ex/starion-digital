import { getPartnerFromSessionCookie } from '@/lib/auth/session';

export async function checkAdminAuth(): Promise<boolean> {
  return !!(await getPartnerFromSessionCookie('ADMIN'));
}

import { getPartnerFromSessionCookie } from '@/lib/auth/session';

// Любой админ (ограниченный ADMIN или SUPER_ADMIN)
export async function checkAdminAuth(): Promise<boolean> {
  return !!(await getPartnerFromSessionCookie(['ADMIN', 'SUPER_ADMIN']));
}

// Только полный доступ - SUPER_ADMIN
export async function checkSuperAdminAuth(): Promise<boolean> {
  return !!(await getPartnerFromSessionCookie('SUPER_ADMIN'));
}

import { getPartnerFromSessionCookie } from '@/lib/auth/session';

// Админ с доступом к заказам (ограниченный ADMIN или SUPER_ADMIN)
export async function checkAdminAuth(): Promise<boolean> {
  return !!(await getPartnerFromSessionCookie(['ADMIN', 'SUPER_ADMIN']));
}

// Админ с доступом к товарам/группам (PRODUCT_ADMIN или SUPER_ADMIN)
export async function checkProductAdminAuth(): Promise<boolean> {
  return !!(
    await getPartnerFromSessionCookie(['PRODUCT_ADMIN', 'SUPER_ADMIN'])
  );
}

// Любой тип админа - используется там, где данные общие для всех ролей
// (например каталог товаров нужен и для формы заказа, и для управления им)
export async function checkAnyAdminAuth(): Promise<boolean> {
  return !!(
    await getPartnerFromSessionCookie(['ADMIN', 'PRODUCT_ADMIN', 'SUPER_ADMIN'])
  );
}

// Только полный доступ - SUPER_ADMIN
export async function checkSuperAdminAuth(): Promise<boolean> {
  return !!(await getPartnerFromSessionCookie('SUPER_ADMIN'));
}

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import AdminDashboard from './admin-dashboard';
import type { AdminOrder, AdminPartner, AdminRealization } from './types';
import { toPlain } from '@/lib/toPlain';

const ADMIN_LOGIN = 'yurix13';

export default async function AdminPage() {
  const session = (await cookies()).get('session')?.value;

  if (!session) redirect('/login');

  // Получаем данные администратора из БД по логину
  const admin = await prisma.partner.findUnique({
    where: { login: ADMIN_LOGIN },
  });

  // Если администратор не создан или сессия не совпадает с его ID или имя не "ADMIN" - запретить доступ
  if (!admin || session !== admin.id.toString() || admin.name !== 'ADMIN') {
    return (
      <div className="min-h-screen p-6 text-center text-destructive font-black">
        Access Denied – Admin Only
      </div>
    );
  }

  const [orders, partners, realizationsRaw] = await Promise.all([
    prisma.order.findMany({
      include: {
        partner: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.partner.findMany(),
    prisma.realization.findMany({
      include: {
        partner: true,
        items: { include: { product: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // ❗ Преобразование Decimal → number
  const realizations = toPlain(realizationsRaw) as AdminRealization[];
  const ordersPlain = toPlain(orders) as AdminOrder[];
  const partnersPlain = toPlain(partners) as AdminPartner[];

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>
        <AdminDashboard
          orders={ordersPlain}
          partners={partnersPlain}
          realizations={realizations}
        />
      </div>
    </main>
  );
}

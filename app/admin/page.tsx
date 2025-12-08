import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import AdminDashboard from './admin-dashboard';

export default async function AdminPage() {
  // Проверяем, что это администратор (ID = 1 или специальный флаг)
  const session = (await cookies()).get('session')?.value;

  if (!session) {
    redirect('/login');
  }

  // Только администратор (partnerId = 1) может получить доступ
  const adminId = Number(session);
  if (adminId !== 1) {
    return <div>Access Denied - Admin Only</div>;
  }

  // Получаем основные данные для аналитики
  const [orders, partners, realizations] = await Promise.all([
    prisma.order.findMany({
      include: {
        partner: true,
        items: { include: { product: true } },
      },
    }),
    prisma.partner.findMany(),
    prisma.realization.findMany({
      include: {
        partner: true,
        items: { include: { product: true } },
        payments: true,
      },
    }),
  ]);

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>
        <AdminDashboard
          orders={orders}
          partners={partners}
          realizations={realizations}
        />
      </div>
    </main>
  );
}

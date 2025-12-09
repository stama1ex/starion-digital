import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import AdminDashboard from './admin-dashboard';
import type { AdminOrder, AdminPartner, AdminRealization } from './types';
import { toPlain } from '@/lib/toPlain';
import { Title } from '@/components/shared/title';

export default async function AdminPage() {
  const session = (await cookies()).get('session')?.value;

  if (!session) redirect('/login');

  const partnerId = Number(session);
  if (!partnerId || Number.isNaN(partnerId)) {
    redirect('/login');
  }

  const currentPartner = await prisma.partner.findUnique({
    where: { id: partnerId },
  });

  // Доступ только если role = ADMIN
  if (!currentPartner || currentPartner.role !== 'ADMIN') {
    return (
      <div className="min-h-screen p-6 text-center text-destructive font-black">
        Access Denied – Admin Only
      </div>
    );
  }

  const [ordersRaw, partnersRaw, realizationsRaw] = await Promise.all([
    prisma.order.findMany({
      select: {
        id: true,
        partnerId: true,
        totalPrice: true,
        status: true,
        isRealization: true,
        createdAt: true,
        partner: {
          select: {
            id: true,
            name: true,
            role: true,
            createdAt: true,
            login: true,
            password: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            pricePerItem: true,
            sum: true,
            product: {
              select: {
                id: true,
                number: true,
                type: true,
                country: true,
                costPrice: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      where: {
        partner: { role: 'PARTNER' },
      },
    }),
    prisma.partner.findMany({
      where: { role: 'PARTNER' },
      select: {
        id: true,
        name: true,
        login: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.realization.findMany({
      select: {
        id: true,
        orderId: true,
        partnerId: true,
        totalCost: true,
        paidAmount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        partner: {
          select: {
            id: true,
            name: true,
            role: true,
            login: true,
            password: true,
            createdAt: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            costPrice: true,
            totalPrice: true,
            product: {
              select: {
                id: true,
                number: true,
                type: true,
              },
            },
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      where: {
        partner: { role: 'PARTNER' },
      },
    }),
  ]);

  const realizations = toPlain(realizationsRaw) as AdminRealization[];
  const ordersPlain = toPlain(ordersRaw) as AdminOrder[];
  const partnersPlain = toPlain(partnersRaw) as AdminPartner[];

  return (
    <main className="min-h-screen bg-background p-2">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-center w-full h-full">
          <Title
            text="Админ панель"
            className="text-[28px] md:text-6xl font-extrabold leading-tight animate-gradient-flow text-center"
          />
        </div>
        <AdminDashboard
          orders={ordersPlain}
          partners={partnersPlain}
          realizations={realizations}
        />
      </div>
    </main>
  );
}

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import AdminDashboard from './admin-dashboard';
import type { AdminOrder, AdminPartner, AdminRealization } from './types';
import { toPlain } from '@/lib/toPlain';
import { Title } from '@/components/shared/title';
import { getPartnerFromSessionCookie } from '@/lib/auth/session';

export default async function AdminPage() {
  const currentPartner = await getPartnerFromSessionCookie([
    'ADMIN',
    'SUPER_ADMIN',
  ]);

  if (!currentPartner) {
    redirect('/login');
  }

  const isSuperAdmin = currentPartner.role === 'SUPER_ADMIN';

  const [ordersRaw, partnersRaw, realizationsRaw, groupsRaw] =
    await Promise.all([
      prisma.order.findMany({
        select: {
          id: true,
          partnerId: true,
          totalPrice: true,
          status: true,
          isRealization: true,
          isMerged: true,
          notes: true,
          address: true,
          customPrices: true,
          createdAt: true,
          partner: {
            select: {
              id: true,
              name: true,
              role: true,
              createdAt: true,
              login: true,
              password: true,
              phone: true,
              address: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
          changeLogs: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              summary: true,
              createdAt: true,
              changedBy: { select: { id: true, name: true, role: true } },
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
                  groupId: true,
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
          phone: true,
          address: true,
          isVip: true,
          role: true,
          createdAt: true,
        },
      }),
      // Ограниченному админу реализации не показываются - не тратим запрос
      isSuperAdmin
        ? prisma.realization.findMany({
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
                      groupId: true,
                    },
                  },
                },
              },
              payments: {
                select: {
                  id: true,
                  amount: true,
                  notes: true,
                  paymentDate: true,
                  createdAt: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            where: {
              partner: { role: 'PARTNER' },
            },
          })
        : Promise.resolve([]),
      prisma.productGroup.findMany({
        orderBy: { slug: 'asc' },
      }),
    ]);

  const realizations = toPlain(realizationsRaw) as AdminRealization[];
  const ordersPlain = toPlain(ordersRaw) as AdminOrder[];
  const partnersPlain = toPlain(partnersRaw) as AdminPartner[];
  const groupsPlain = toPlain(groupsRaw);

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
          groups={groupsPlain}
          isSuperAdmin={isSuperAdmin}
        />
      </div>
    </main>
  );
}

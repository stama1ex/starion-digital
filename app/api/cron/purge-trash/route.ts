import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkSuperAdminAuth } from '../../admin/auth-utils';

const TRASH_RETENTION_DAYS = 7;

// Разрешаем запуск двум способам (см. app/api/cron/backup/route.ts):
// 1) Vercel Cron — шлёт заголовок Authorization: Bearer <CRON_SECRET>
// 2) Вручную из админки - обычная сессия супер-админа
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  ) {
    return true;
  }
  return checkSuperAdminAuth();
}

// Ежедневная очистка "Корзины": заказы, лежащие в ней больше 7 дней,
// удаляются окончательно (каскадно вместе с items/realization).
export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - TRASH_RETENTION_DAYS);

    const result = await prisma.order.deleteMany({
      where: { deletedAt: { lt: threshold } },
    });

    return NextResponse.json({ ok: true, purgedCount: result.count });
  } catch (error) {
    console.error('Purge trash error:', error);
    return NextResponse.json(
      { error: 'Purge failed', details: String(error) },
      { status: 500 },
    );
  }
}

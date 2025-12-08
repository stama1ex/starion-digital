import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';

const ADMIN_LOGIN = 'yurix13';

export async function checkAdminAuth(): Promise<boolean> {
  try {
    const session = (await cookies()).get('session')?.value;
    if (!session) return false;

    const partnerId = Number(session);
    const admin = await prisma.partner.findUnique({
      where: { id: partnerId },
    });

    return admin?.login === ADMIN_LOGIN && admin?.name === 'ADMIN';
  } catch {
    return false;
  }
}

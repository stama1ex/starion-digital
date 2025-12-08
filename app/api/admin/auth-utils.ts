import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';

export async function checkAdminAuth(): Promise<boolean> {
  const session = (await cookies()).get('session')?.value;
  if (!session) return false;

  const id = Number(session);
  if (!id || Number.isNaN(id)) return false;

  const partner = await prisma.partner.findUnique({
    where: { id },
  });

  return !!partner && partner.role === 'ADMIN';
}

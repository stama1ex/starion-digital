import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET() {
  const session = (await cookies()).get('session')?.value;

  if (!session) return Response.json({ isPartner: false });

  const partner = await prisma.partner.findUnique({
    where: { id: Number(session) },
    select: { id: true },
  });

  return Response.json({ isPartner: !!partner });
}

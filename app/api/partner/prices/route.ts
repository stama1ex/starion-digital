import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET() {
  const session = (await cookies()).get('session')?.value;
  if (!session) return new Response('Unauthorized', { status: 401 });

  const partnerId = parseInt(session);

  const prices = await prisma.price.findMany({
    where: { partnerId },
    select: { type: true, group: true, price: true },
  });

  return Response.json(prices);
}

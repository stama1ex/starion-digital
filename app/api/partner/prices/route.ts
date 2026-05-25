import { prisma } from '@/lib/db';
import { getPartnerFromSessionCookie } from '@/lib/auth/session';

export async function GET() {
  const partner = await getPartnerFromSessionCookie();
  if (!partner) return new Response('Unauthorized', { status: 401 });

  const partnerId = partner.id;

  const prices = await prisma.price.findMany({
    where: { partnerId },
    select: { type: true, group: true, price: true },
  });

  return Response.json(prices);
}

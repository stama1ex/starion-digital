import { getPartnerFromSessionCookie } from '@/lib/auth/session';

export async function GET() {
  try {
    const partner = await getPartnerFromSessionCookie();

    return Response.json({ isPartner: !!partner });
  } catch (error) {
    console.error('Error checking partner session:', error);
    return Response.json({ isPartner: false }, { status: 500 });
  }
}

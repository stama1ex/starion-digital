import { getPartnerFromSessionCookie } from '@/lib/auth/session';

export async function GET() {
  try {
    const partner = await getPartnerFromSessionCookie();

    if (!partner) {
      return Response.json({ isPartner: false });
    }

    return Response.json({
      isPartner: true,
      address: partner.address,
      isVip: partner.isVip,
      role: partner.role,
      hasEmail: !!partner.email,
    });
  } catch (error) {
    console.error('Error checking partner session:', error);
    return Response.json({ isPartner: false }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const isPartnerPage = req.nextUrl.pathname.startsWith('/order');
  const session = req.cookies.get('session')?.value;

  if (isPartnerPage && !session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const protectedPaths = ['/order', '/api/order'];

  if (protectedPaths.some((p) => req.nextUrl.pathname.startsWith(p))) {
    const session = req.cookies.get('session')?.value;
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.next();
}

// Ограничиваем действие на все маршруты
export const config = {
  matcher: ['/order/:path*', '/api/order/:path*'],
};

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const ADMIN_COOKIE = 'admin';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAdmin = request.cookies.get(ADMIN_COOKIE)?.value === '1';

  if (pathname.startsWith('/admin')) {
    if (!hasAdmin) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  if (pathname === '/login' && hasAdmin) {
    const adminUrl = new URL('/admin', request.url);
    return NextResponse.redirect(adminUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};

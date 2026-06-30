import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth(async (req) => {
  const session = req.auth;
  const path = req.nextUrl.pathname;
  const isLoggedIn = !!session?.user;

  // Protect dashboard and superadmin
  if ((path.startsWith('/dashboard') || path.startsWith('/superadmin')) && !isLoggedIn) {
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }

  // Protect superadmin — must have SUPERADMIN role
  if (path.startsWith('/superadmin') && isLoggedIn) {
    const role = (session.user as any).role;
    if (role !== 'SUPERADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // Redirect logged-in users away from auth pages
  if (path.startsWith('/auth') && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
});

export const config = {
  matcher: ['/dashboard/:path*', '/superadmin/:path*', '/auth/:path*'],
};

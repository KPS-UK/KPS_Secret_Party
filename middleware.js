import { NextResponse } from 'next/server';
import { getSessionTokenEdge } from './lib/auth-edge';
import { SESSION_MAX_AGE } from './lib/session';

// Paths that must stay reachable without a session, otherwise nobody could
// ever log in (the login page itself and the endpoint that sets the cookie).
const PUBLIC_PATHS = ['/login'];

function isPublic(pathname) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith('/api/admin/login')) return true;
  return false;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('kps_admin')?.value;
  const expected = await getSessionTokenEdge();
  const authed = Boolean(token) && token === expected;

  if (!authed) {
    const loginUrl = new URL('/login', request.url);
    // Remember where they were headed, so login can send them back there
    // instead of always landing on the check-in home page.
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Sliding expiry: every authenticated request resets the timer, so the
  // session only expires after SESSION_MAX_AGE of no activity, not a fixed
  // time since login.
  const response = NextResponse.next();
  response.cookies.set('kps_admin', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

// Runs on everything except Next's own static/image assets and the
// favicon. Add any other public static files (e.g. the KPS logo) here if
// they stop loading on the login screen.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|kps-logo.png).*)'],
};
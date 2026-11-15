import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, notSignedInResponse, verifySession } from '@/lib/security/session';

// These API paths are open without a session. The matcher below excludes static assets.
const PUBLIC_API_PATHS = new Set(['/api/login', '/api/logout']);

/**
 * Protects every page and API route with the shared-code session (spec 8.2).
 * Each route handler also checks the session itself.
 */
export async function proxy(request: NextRequest): Promise<Response> {
  const { pathname } = request.nextUrl;
  const signedIn = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === '/login') {
    return signedIn ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  }
  if (signedIn || PUBLIC_API_PATHS.has(pathname)) return NextResponse.next();
  if (pathname === '/api' || pathname.startsWith('/api/')) return notSignedInResponse();
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

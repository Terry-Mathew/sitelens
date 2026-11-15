import { clearedSessionCookie } from '@/lib/security/session';

export const runtime = 'nodejs';

// Logout needs no session. It only removes the cookie.
export async function POST(): Promise<Response> {
  return Response.json({ ok: true }, { status: 200, headers: { 'Set-Cookie': clearedSessionCookie() } });
}

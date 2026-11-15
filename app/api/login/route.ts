import { checkLoginLimit, getClientIp, type LimitResult } from '@/lib/ratelimit';
import { isAccessCode, sessionCookie, signSession } from '@/lib/security/session';

export const runtime = 'nodejs';

const WRONG_CODE = "That code didn't work.";
const NOT_CONFIGURED = 'Access is not configured.';
const NOT_AVAILABLE = 'The service is not available. Try again later.';

async function readCode(req: Request): Promise<string> {
  try {
    const body: unknown = await req.json();
    if (body && typeof body === 'object' && 'code' in body && typeof body.code === 'string') {
      return body.code;
    }
  } catch {
    // A body that is not JSON is a wrong code.
  }
  return '';
}

export async function POST(req: Request): Promise<Response> {
  // Fail closed when the env is not set.
  if (!process.env.ACCESS_CODE || !process.env.SESSION_SECRET) {
    return Response.json({ error: NOT_CONFIGURED }, { status: 500 });
  }

  // Check the rate limit before the code, so each attempt counts.
  let limit: LimitResult;
  try {
    limit = await checkLoginLimit(getClientIp(req));
  } catch {
    // Do not show limiter error details to the user.
    return Response.json({ error: NOT_AVAILABLE }, { status: 503 });
  }
  if (!limit.ok) return Response.json({ error: limit.message }, { status: 429 });

  const code = await readCode(req);
  if (!code || !(await isAccessCode(code))) {
    return Response.json({ error: WRONG_CODE }, { status: 401 });
  }

  const token = await signSession();
  return Response.json({ ok: true }, { status: 200, headers: { 'Set-Cookie': sessionCookie(token) } });
}

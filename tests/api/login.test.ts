import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const checkLoginLimit = vi.fn();
vi.mock('@/lib/ratelimit', () => ({
  checkLoginLimit: (ip: string) => checkLoginLimit(ip),
  getClientIp: (req: Request) => req.headers.get('x-real-ip') ?? 'unknown',
}));

import { POST } from '@/app/api/login/route';
import { SESSION_COOKIE, verifySession } from '@/lib/security/session';

function login(body: unknown, ip = '203.0.113.7') {
  return new Request('http://localhost/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv('SESSION_SECRET', 'test-secret-0123456789abcdef');
  vi.stubEnv('ACCESS_CODE', 'open-sesame');
  checkLoginLimit.mockReset();
  checkLoginLimit.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/login', () => {
  it('sets the cookie on the correct code', async () => {
    const res = await POST(login({ code: 'open-sesame' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
    expect(cookie).not.toContain('Secure');

    const token = cookie.split(';')[0].split('=')[1];
    expect(await verifySession(token)).toBe(true);
  });

  it('adds Secure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await POST(login({ code: 'open-sesame' }));
    expect(res.headers.get('set-cookie')).toContain('Secure');
  });

  it('returns 401 on a wrong code', async () => {
    const res = await POST(login({ code: 'wrong' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "That code didn't work." });
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('returns 401 on a missing or malformed body', async () => {
    for (const body of [{}, { code: 42 }, 'not json', '']) {
      const res = await POST(login(body));
      expect(res.status).toBe(401);
      expect(res.headers.get('set-cookie')).toBeNull();
    }
  });

  it('returns 429 with a friendly message when rate-limited', async () => {
    checkLoginLimit.mockResolvedValue({ ok: false, message: 'Too many attempts. Please wait 15 minutes.' });
    const res = await POST(login({ code: 'open-sesame' }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'Too many attempts. Please wait 15 minutes.' });
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('checks the limit by client IP before it checks the code', async () => {
    await POST(login({ code: 'wrong' }, '198.51.100.9'));
    expect(checkLoginLimit).toHaveBeenCalledWith('198.51.100.9');
  });

  it('returns 503 without details when the limiter throws', async () => {
    checkLoginLimit.mockRejectedValue(new Error('upstash down at 10.0.0.1'));
    const res = await POST(login({ code: 'open-sesame' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'The service is not available. Try again later.' });
  });

  it('returns 503 when rate limiting is not configured', async () => {
    checkLoginLimit.mockResolvedValue({ ok: false, unconfigured: true, message: 'The service is not available. Try again later.' });
    const res = await POST(login({ code: 'open-sesame' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'The service is not available. Try again later.' });
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('fails closed with 503 when ACCESS_CODE or SESSION_SECRET is missing', async () => {
    for (const name of ['ACCESS_CODE', 'SESSION_SECRET']) {
      vi.stubEnv(name, '');
      const res = await POST(login({ code: '' }));
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'The service is not available. Try again later.' });
      expect(res.headers.get('set-cookie')).toBeNull();
      vi.stubEnv(name, name === 'ACCESS_CODE' ? 'open-sesame' : 'test-secret-0123456789abcdef');
    }
  });
});

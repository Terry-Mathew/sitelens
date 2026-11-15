import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/logout/route';
import { SESSION_COOKIE } from '@/lib/security/session';

describe('POST /api/logout', () => {
  it('clears the session cookie without a session', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`${SESSION_COOKIE}=;`);
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/');
  });
});

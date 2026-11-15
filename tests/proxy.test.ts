import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { config, proxy } from '@/proxy';
import { SESSION_COOKIE, signSession } from '@/lib/security/session';

function request(path: string, token?: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
  });
}

/** NextResponse.next() marks the response with this header. */
const passedThrough = (res: Response) => res.headers.get('x-middleware-next') === '1';

beforeEach(() => {
  vi.stubEnv('SESSION_SECRET', 'test-secret-0123456789abcdef');
  vi.stubEnv('ACCESS_CODE', 'open-sesame');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('proxy', () => {
  it('redirects unauthenticated page requests to /login', async () => {
    for (const path of ['/', '/scan/abc', '/report?id=1']) {
      const res = await proxy(request(path));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
    }
  });

  it('redirects a page request with an invalid cookie', async () => {
    const res = await proxy(request('/', '123.forged'));
    expect(res.status).toBe(307);
  });

  it('returns 401 JSON for unauthenticated /api/scan', async () => {
    const res = await proxy(request('/api/scan'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Not signed in.' });
  });

  it('allows /login and /api/login without a session', async () => {
    expect(passedThrough(await proxy(request('/login')))).toBe(true);
    expect(passedThrough(await proxy(request('/api/login')))).toBe(true);
    expect(passedThrough(await proxy(request('/api/logout')))).toBe(true);
  });

  it('does not treat look-alike paths as public', async () => {
    expect((await proxy(request('/api/login-extra'))).status).toBe(401);
    expect((await proxy(request('/loginx'))).status).toBe(307);
  });

  it('allows authenticated requests through', async () => {
    const token = await signSession();
    expect(passedThrough(await proxy(request('/', token)))).toBe(true);
    expect(passedThrough(await proxy(request('/api/scan', token)))).toBe(true);
  });

  it('sends an authenticated user from /login to /', async () => {
    const token = await signSession();
    const res = await proxy(request('/login', token));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/');
  });

  it('excludes static assets in the matcher', () => {
    const source = config.matcher[0];
    const re = new RegExp(`^${source}$`);
    expect(re.test('/_next/static/chunk.js')).toBe(false);
    expect(re.test('/_next/image')).toBe(false);
    expect(re.test('/favicon.ico')).toBe(false);
    expect(re.test('/')).toBe(true);
    expect(re.test('/api/scan')).toBe(true);
    expect(re.test('/login')).toBe(true);
  });
});

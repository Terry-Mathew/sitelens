import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SESSION_COOKIE,
  isAccessCode,
  requireSession,
  signSession,
  verifySession,
} from '@/lib/security/session';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 15, 12, 0, 0);

beforeEach(() => {
  vi.stubEnv('SESSION_SECRET', 'test-secret-0123456789abcdef');
  vi.stubEnv('ACCESS_CODE', 'open-sesame');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('session token', () => {
  it('uses the agreed cookie name', () => {
    expect(SESSION_COOKIE).toBe('sitelens_session');
  });

  it('has the format <expiryMs>.<base64url signature>', async () => {
    const token = await signSession(NOW);
    expect(token).toMatch(/^\d+\.[A-Za-z0-9_-]+$/);
    expect(Number(token.split('.')[0])).toBe(NOW + 30 * DAY_MS);
  });

  it('verifies a fresh token', async () => {
    const token = await signSession(NOW);
    expect(await verifySession(token, NOW + 1000)).toBe(true);
  });

  it('accepts a token on the last valid millisecond (30 days)', async () => {
    const token = await signSession(NOW);
    expect(await verifySession(token, NOW + 30 * DAY_MS)).toBe(true);
  });

  it('rejects a tampered token', async () => {
    const token = await signSession(NOW);
    const [expiry, sig] = token.split('.');
    const longer = `${Number(expiry) + DAY_MS}.${sig}`;
    const flipped = `${expiry}.${sig.slice(0, -2)}${sig.endsWith('AA') ? 'BB' : 'AA'}`;
    expect(await verifySession(longer, NOW)).toBe(false);
    expect(await verifySession(flipped, NOW)).toBe(false);
  });

  it('rejects an expired token (30 days + 1 ms)', async () => {
    const token = await signSession(NOW);
    expect(await verifySession(token, NOW + 30 * DAY_MS + 1)).toBe(false);
  });

  it('rejects when SESSION_SECRET changes', async () => {
    const token = await signSession(NOW);
    vi.stubEnv('SESSION_SECRET', 'a-different-secret-value');
    expect(await verifySession(token, NOW)).toBe(false);
  });

  it('rejects when ACCESS_CODE changes (spec 8.2: a code change revokes access)', async () => {
    const token = await signSession(NOW);
    vi.stubEnv('ACCESS_CODE', 'new-code');
    expect(await verifySession(token, NOW)).toBe(false);
  });

  it('rejects missing and malformed tokens', async () => {
    for (const bad of [undefined, '', 'abc', '123', '123.', '.abc', 'x.y', '12.3.4', '1e3.abc']) {
      expect(await verifySession(bad, NOW)).toBe(false);
    }
  });

  it('fails closed when SESSION_SECRET is missing', async () => {
    const token = await signSession(NOW);
    vi.stubEnv('SESSION_SECRET', '');
    expect(await verifySession(token, NOW)).toBe(false);
    await expect(signSession(NOW)).rejects.toThrow();
  });
});

describe('isAccessCode', () => {
  it('accepts only the exact code', async () => {
    expect(await isAccessCode('open-sesame')).toBe(true);
    expect(await isAccessCode('open-sesame ')).toBe(false);
    expect(await isAccessCode('OPEN-SESAME')).toBe(false);
    expect(await isAccessCode('')).toBe(false);
  });

  it('returns false when ACCESS_CODE is missing', async () => {
    vi.stubEnv('ACCESS_CODE', '');
    expect(await isAccessCode('')).toBe(false);
  });
});

describe('requireSession', () => {
  function req(cookie?: string) {
    return new Request('http://localhost/api/scan', {
      headers: cookie ? { cookie } : {},
    });
  }

  it('returns null for a valid session cookie', async () => {
    const token = await signSession();
    expect(await requireSession(req(`other=1; ${SESSION_COOKIE}=${token}`))).toBeNull();
  });

  it('returns a 401 JSON response with no cookie', async () => {
    const res = await requireSession(req());
    expect(res?.status).toBe(401);
    expect(await res?.json()).toEqual({ error: 'Not signed in.' });
  });

  it('returns 401 for an invalid cookie', async () => {
    const res = await requireSession(req(`${SESSION_COOKIE}=123.abc`));
    expect(res?.status).toBe(401);
  });
});

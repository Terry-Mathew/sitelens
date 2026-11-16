import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePage } from '@/tests/helpers/page';

const checkScanLimit = vi.fn();
const normaliseAndValidateUrl = vi.fn();
const gather = vi.fn();
const issuePerformanceTicket = vi.fn();

vi.mock('@/lib/ratelimit', () => ({
  checkScanLimit: (ip: string) => checkScanLimit(ip),
  getClientIp: (req: Request) => req.headers.get('x-real-ip') ?? 'unknown',
}));
vi.mock('@/lib/security/url', () => ({
  normaliseAndValidateUrl: (input: string) => normaliseAndValidateUrl(input),
}));
vi.mock('@/lib/gather', () => ({
  gather: (url: string) => gather(url),
}));
vi.mock('@/lib/tickets', () => ({
  issuePerformanceTicket: (id: string, url: string) => issuePerformanceTicket(id, url),
}));

import { POST } from '@/app/api/scan/route';
import { checks } from '@/lib/checks/registry';

const BAD_URL = 'Enter a valid website address.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function scan(body: unknown) {
  return new Request('http://localhost/api/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.7' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  checkScanLimit.mockReset().mockResolvedValue({ ok: true });
  normaliseAndValidateUrl.mockReset().mockResolvedValue({ ok: true, url: 'https://example.com/' });
  gather.mockReset().mockResolvedValue(makePage());
  issuePerformanceTicket.mockReset().mockResolvedValue('ticket-123');
});

describe('POST /api/scan', () => {
  it('runs a scan without a session cookie or an access code', async () => {
    vi.stubEnv('ACCESS_CODE', '');
    vi.stubEnv('SESSION_SECRET', '');
    const res = await POST(scan({ url: 'example.com' }));
    vi.unstubAllEnvs();
    expect(res.status).toBe(200);
    expect(checkScanLimit).toHaveBeenCalledWith('203.0.113.7');
    expect(gather).toHaveBeenCalledWith('https://example.com/');
  });

  it.each([
    ['bad JSON', '{not json'],
    ['missing url', {}],
    ['non-string url', { url: 42 }],
    ['url over 2048 characters', { url: 'a'.repeat(2049) }],
  ])('returns 400 for %s', async (_name, body) => {
    const res = await POST(scan(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: BAD_URL });
    expect(checkScanLimit).not.toHaveBeenCalled();
  });

  it('returns 429 with the limiter message', async () => {
    checkScanLimit.mockResolvedValue({ ok: false, message: 'Too many scans. Try later.' });
    const res = await POST(scan({ url: 'example.com' }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'Too many scans. Try later.' });
    expect(checkScanLimit).toHaveBeenCalledWith('203.0.113.7');
    expect(gather).not.toHaveBeenCalled();
  });

  it('returns 503 (not 429) when rate limiting is not configured', async () => {
    checkScanLimit.mockResolvedValue({ ok: false, unconfigured: true, message: 'The service is not available. Try again later.' });
    const res = await POST(scan({ url: 'example.com' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'The service is not available. Try again later.' });
    expect(gather).not.toHaveBeenCalled();
  });

  it('returns 503 when the limiter throws', async () => {
    checkScanLimit.mockRejectedValue(new Error('upstash down'));
    const res = await POST(scan({ url: 'example.com' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'The service is not available. Try again later.' });
  });

  it('returns 400 with the validator error', async () => {
    normaliseAndValidateUrl.mockResolvedValue({ ok: false, error: 'This address is not allowed.' });
    const res = await POST(scan({ url: 'http://10.0.0.1' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'This address is not allowed.' });
    expect(gather).not.toHaveBeenCalled();
  });

  it('returns 200 with a scan for every registered check', async () => {
    const res = await POST(scan({ url: 'example.com' }));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.performanceTicket).toBe('ticket-123');
    const { scan: result } = body;
    expect(result.id).toMatch(UUID);
    expect(result.url).toBe('https://example.com/');
    expect(result.finalUrl).toBe('https://example.com/');
    expect(new Date(result.scannedAt).toISOString()).toBe(result.scannedAt);
    expect(result.jsRendered).toBe(false);
    expect(result.loadedWith).toBe('firecrawl');
    expect(result.limitations).toEqual([]);
    expect(result.findings).toHaveLength(checks.length);

    expect(gather).toHaveBeenCalledWith('https://example.com/');
    expect(issuePerformanceTicket).toHaveBeenCalledWith(result.id, result.url);
  });

  it('returns a generic 500 when gather throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    gather.mockRejectedValue(new Error('secret internal detail at https://example.com/'));
    const res = await POST(scan({ url: 'example.com' }));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: 'Scan failed. Please try again.' });
    expect(text).not.toContain('secret');
    expect(text).not.toContain('example.com');
    for (const call of spy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('example.com');
      expect(JSON.stringify(call)).not.toContain('secret');
    }
  });
});

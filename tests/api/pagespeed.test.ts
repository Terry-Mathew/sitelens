import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireSession = vi.fn();
const checkPageSpeedLimit = vi.fn();
const normaliseAndValidateUrl = vi.fn();
const redeemPerformanceTicket = vi.fn();
const verifyPerformanceTicket = vi.fn();
const providerFetch = vi.fn();

vi.mock('@/lib/security/session', () => ({
  requireSession: (req: Request) => requireSession(req),
}));
vi.mock('@/lib/ratelimit', () => ({
  checkPageSpeedLimit: (ip: string) => checkPageSpeedLimit(ip),
  getClientIp: (req: Request) => req.headers.get('x-real-ip') ?? 'unknown',
}));
vi.mock('@/lib/security/url', () => ({
  normaliseAndValidateUrl: (input: string) => normaliseAndValidateUrl(input),
}));
vi.mock('@/lib/tickets', () => ({
  redeemPerformanceTicket: (ticket: string, url: string) => redeemPerformanceTicket(ticket, url),
  verifyPerformanceTicket: (ticket: string, url: string) => verifyPerformanceTicket(ticket, url),
}));
vi.mock('@/lib/performance', () => ({
  getPerformanceProvider: () => ({ id: 'test', fetch: (url: string) => providerFetch(url) }),
}));

import * as route from '@/app/api/pagespeed/route';

const { POST } = route;
const BAD_URL = 'Enter a valid website address.';

function call(body: unknown) {
  return new Request('http://localhost/api/pagespeed', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.7' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  requireSession.mockReset().mockResolvedValue(null);
  checkPageSpeedLimit.mockReset().mockResolvedValue({ ok: true });
  normaliseAndValidateUrl.mockReset().mockResolvedValue({ ok: true, url: 'https://example.com/' });
  redeemPerformanceTicket.mockReset().mockResolvedValue({ ok: true });
  verifyPerformanceTicket.mockReset().mockResolvedValue({ ok: true });
  providerFetch.mockReset().mockResolvedValue({ ok: false, unavailable: 'Google PageSpeed could not test this page.' });
});

describe('POST /api/pagespeed', () => {
  it('exports nodejs runtime, maxDuration 90, and POST only', () => {
    expect(route.runtime).toBe('nodejs');
    expect(route.maxDuration).toBe(90);
    expect(Object.keys(route).filter((k) => ['GET', 'PUT', 'PATCH', 'DELETE'].includes(k))).toEqual([]);
  });

  it('returns 401 without a session and does nothing else', async () => {
    requireSession.mockResolvedValue(new Response(null, { status: 401 }));
    const res = await POST(call({ url: 'example.com', ticket: 't' }));
    expect(res.status).toBe(401);
    expect(checkPageSpeedLimit).not.toHaveBeenCalled();
    expect(redeemPerformanceTicket).not.toHaveBeenCalled();
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it.each([
    ['bad JSON', '{not json'],
    ['missing url', { ticket: 't' }],
    ['missing ticket', { url: 'example.com' }],
    ['non-string url', { url: 1, ticket: 't' }],
    ['non-string ticket', { url: 'example.com', ticket: 1 }],
    ['empty ticket', { url: 'example.com', ticket: '' }],
    ['url over 2048 characters', { url: 'a'.repeat(2049), ticket: 't' }],
  ])('returns 400 for %s', async (_n, body) => {
    const res = await POST(call(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: BAD_URL });
    expect(checkPageSpeedLimit).not.toHaveBeenCalled();
  });

  it('returns 429 with the limit message when the limit is hit', async () => {
    checkPageSpeedLimit.mockResolvedValue({ ok: false, message: 'Too many checks.' });
    const res = await POST(call({ url: 'example.com', ticket: 't' }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'Too many checks.' });
    expect(checkPageSpeedLimit).toHaveBeenCalledWith('203.0.113.7');
    expect(redeemPerformanceTicket).not.toHaveBeenCalled();
  });

  it('returns 503 when the limiter throws', async () => {
    checkPageSpeedLimit.mockRejectedValue(new Error('redis down'));
    const res = await POST(call({ url: 'example.com', ticket: 't' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'The service is not available. Try again later.' });
  });

  it('returns 400 when URL validation fails', async () => {
    normaliseAndValidateUrl.mockResolvedValue({ ok: false, error: 'That address is not allowed.' });
    const res = await POST(call({ url: 'localhost', ticket: 't' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'That address is not allowed.' });
    expect(redeemPerformanceTicket).not.toHaveBeenCalled();
  });

  it.each(['missing', 'used', 'mismatched'])('returns 403 with the redeem error for a %s ticket', async () => {
    redeemPerformanceTicket.mockResolvedValue({ ok: false, error: 'This performance ticket is not valid.' });
    const res = await POST(call({ url: 'example.com', ticket: 't' }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'This performance ticket is not valid.' });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid', 'This performance ticket is not valid.'],
    ['expired', 'This performance ticket has expired.'],
    ['mismatched', 'This performance ticket is for a different website.'],
  ])('returns 403 for an %s ticket without using a limiter slot', async (_n, error) => {
    verifyPerformanceTicket.mockResolvedValue({ ok: false, error });
    const res = await POST(call({ url: 'example.com', ticket: 't' }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error });
    expect(checkPageSpeedLimit).not.toHaveBeenCalled();
    expect(redeemPerformanceTicket).not.toHaveBeenCalled();
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('verifies the ticket, then checks the limit, then uses the ticket', async () => {
    const order: string[] = [];
    verifyPerformanceTicket.mockImplementation(async () => (order.push('verify'), { ok: true }));
    checkPageSpeedLimit.mockImplementation(async () => (order.push('limit'), { ok: true }));
    redeemPerformanceTicket.mockImplementation(async () => (order.push('redeem'), { ok: true }));
    await POST(call({ url: ' Example.com/x ', ticket: 'ticket-1' }));
    expect(order).toEqual(['verify', 'limit', 'redeem']);
    expect(verifyPerformanceTicket).toHaveBeenCalledWith('ticket-1', 'https://example.com/');
  });

  it('does not use the ticket when the limit is hit', async () => {
    checkPageSpeedLimit.mockResolvedValue({ ok: false, message: 'Too many checks.' });
    const res = await POST(call({ url: 'example.com', ticket: 't' }));
    expect(res.status).toBe(429);
    expect(redeemPerformanceTicket).not.toHaveBeenCalled();
  });

  it('redeems the ticket against the validated URL, not the raw input', async () => {
    await POST(call({ url: ' Example.com/x?y=1 ', ticket: 'ticket-1' }));
    expect(redeemPerformanceTicket).toHaveBeenCalledWith('ticket-1', 'https://example.com/');
    expect(providerFetch).toHaveBeenCalledWith('https://example.com/');
  });

  it('returns 200 with an ok outcome', async () => {
    const outcome = { ok: true, data: { strategy: 'mobile' } };
    providerFetch.mockResolvedValue(outcome);
    const res = await POST(call({ url: 'example.com', ticket: 't' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(outcome);
  });

  it('returns 200 with an unavailable outcome', async () => {
    const res = await POST(call({ url: 'example.com', ticket: 't' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, unavailable: 'Google PageSpeed could not test this page.' });
  });

  it('returns 500 with a fixed message when the route throws unexpectedly', async () => {
    providerFetch.mockRejectedValue(new Error('secret https://example.com'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(call({ url: 'example.com', ticket: 't' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Performance check failed. Please try again.' });
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/example\.com|secret/);
    spy.mockRestore();
  });
});

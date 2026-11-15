import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkHttpRedirect,
  fetchFavicon,
  fetchHomepage,
  fetchLlmsTxt,
} from '@/lib/gather/direct';
import type { SafeFetchResult } from '@/lib/security/safe-fetch';

const fixture = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8');

const ok = (
  body: string,
  over: { status?: number; contentType?: string | null; finalUrl?: string; redirectChain?: string[] } = {},
): SafeFetchResult => ({
  ok: true,
  status: over.status ?? 200,
  finalUrl: over.finalUrl ?? 'https://example.com/',
  redirectChain: over.redirectChain ?? [],
  headers: over.contentType === null ? {} : { 'content-type': over.contentType ?? 'text/html; charset=utf-8' },
  body,
  truncated: false,
});

const failure = (reason: Extract<SafeFetchResult, { ok: false }>['reason']): SafeFetchResult => ({
  ok: false,
  reason,
  message: 'connect ECONNREFUSED 10.0.0.5:443',
});

const fetcherOf = (...results: SafeFetchResult[]) => {
  const fn = vi.fn();
  results.forEach((r) => fn.mockResolvedValueOnce(r));
  fn.mockResolvedValue(results[results.length - 1]);
  return fn;
};

describe('fetchHomepage', () => {
  it('returns raw html, headers, and redirect chain for a normal page', async () => {
    const f = fetcherOf(ok('<html><body>Hi</body></html>', { redirectChain: ['http://example.com/'] }));
    const r = await fetchHomepage('http://example.com/', f);
    expect(r.status).toBe(200);
    expect(r.blocked).toBe(false);
    expect(r.rawHtml).toBe('<html><body>Hi</body></html>');
    expect(r.contentType).toBe('text/html; charset=utf-8');
    expect(r.redirectChain).toEqual(['http://example.com/']);
    expect(r.finalUrl).toBe('https://example.com/');
    expect(r.httpFallback).toBeUndefined();
    expect(f).toHaveBeenCalledWith('http://example.com/', { timeoutMs: 10_000, maxBytes: 5 * 1024 * 1024 });
  });

  it.each([401, 403, 429])('marks %i as blocked with reason "This site blocked our automated check"', async (status) => {
    const r = await fetchHomepage('https://example.com/', fetcherOf(ok('denied', { status })));
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toBe('This site blocked our automated check');
    expect(r.status).toBe(status);
    expect(r.rawHtml).toBeNull();
  });

  it('detects a Cloudflare-style challenge page as blocked', async () => {
    const f = fetcherOf(ok(fixture('cloudflare-challenge.html'), { status: 503 }));
    const r = await fetchHomepage('https://example.com/', f);
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toBe('This site blocked our automated check');
    expect(r.unreachableReason).toBeUndefined();
    expect(r.rawHtml).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('marks a DNS name that does not exist as not found', async () => {
    const r = await fetchHomepage('https://example.com/', fetcherOf(failure('dns')));
    expect(r.unreachableReason).toBe('The website address could not be found');
    expect(r.blocked).toBe(false);
    expect(r.status).toBeNull();
    expect(r.rawHtml).toBeNull();
  });

  it('marks a temporary DNS failure as unreachable, not as not found', async () => {
    const r = await fetchHomepage('https://example.com/', fetcherOf(failure('dns_transient')));
    expect(r.unreachableReason).toBe('The website could not be reached');
    expect(r.status).toBeNull();
  });

  it('marks too many redirects as unreachable, not as not found', async () => {
    const r = await fetchHomepage('https://example.com/', fetcherOf(failure('too_many_redirects')));
    expect(r.unreachableReason).toBe('The website could not be reached');
  });

  it('tries http:// once when https:// fails at the connection or TLS step, and uses a 2xx answer', async () => {
    const f = fetcherOf(failure('network'), ok('<html><body>http only</body></html>', { finalUrl: 'http://example.com/' }));
    const r = await fetchHomepage('https://example.com/', f);
    expect(f).toHaveBeenCalledTimes(2);
    expect(f).toHaveBeenNthCalledWith(2, 'http://example.com/', { timeoutMs: 10_000, maxBytes: 5 * 1024 * 1024 });
    expect(r.status).toBe(200);
    expect(r.finalUrl).toBe('http://example.com/');
    expect(r.rawHtml).toBe('<html><body>http only</body></html>');
    expect(r.unreachableReason).toBeUndefined();
    expect(r.httpFallback).toBe(true);
  });

  it('keeps the https:// failure when the http:// try also fails', async () => {
    const f = fetcherOf(failure('network'), failure('network'));
    const r = await fetchHomepage('https://example.com/', f);
    expect(f).toHaveBeenCalledTimes(2);
    expect(r.finalUrl).toBe('https://example.com/');
    expect(r.unreachableReason).toBe('The website could not be reached');
    expect(r.status).toBeNull();
  });

  it('keeps the https:// failure when the http:// try answers with an error status', async () => {
    const f = fetcherOf(failure('network'), ok('gone', { status: 404, finalUrl: 'http://example.com/' }));
    const r = await fetchHomepage('https://example.com/', f);
    expect(r.finalUrl).toBe('https://example.com/');
    expect(r.status).toBeNull();
    expect(r.unreachableReason).toBe('The website could not be reached');
  });

  it.each(['timeout', 'dns', 'dns_transient', 'too_large', 'blocked_address', 'too_many_redirects'] as const)(
    'does not try http:// after a %s failure',
    async (reason) => {
      const f = fetcherOf(failure(reason), ok('<p>x</p>', { finalUrl: 'http://example.com/' }));
      await fetchHomepage('https://example.com/', f);
      expect(f).toHaveBeenCalledTimes(1);
    },
  );

  it('does not try again when the input is already http://', async () => {
    const f = fetcherOf(failure('network'), ok('<p>x</p>'));
    await fetchHomepage('http://example.com/', f);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('marks a network failure as unreachable without leaking the raw message', async () => {
    const r = await fetchHomepage('https://example.com/', fetcherOf(failure('network')));
    expect(r.unreachableReason).toBe('The website could not be reached');
    expect(JSON.stringify(r)).not.toContain('10.0.0.5');
  });

  it('marks a timeout as blocked, not unreachable', async () => {
    const r = await fetchHomepage('https://example.com/', fetcherOf(failure('timeout')));
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toBe('The website did not respond in time');
    expect(r.unreachableReason).toBeUndefined();
  });

  it('marks a blocked address as unreachable with a fixed reason', async () => {
    const r = await fetchHomepage('https://example.com/', fetcherOf(failure('blocked_address')));
    expect(r.unreachableReason).toBe('The website address is not allowed');
    expect(JSON.stringify(r)).not.toContain('10.0.0.5');
  });

  it('retries a 5xx once, then reports unreachable', async () => {
    const f = fetcherOf(ok('oops', { status: 502 }), ok('oops again', { status: 502 }));
    const r = await fetchHomepage('https://example.com/', f);
    expect(f).toHaveBeenCalledTimes(2);
    expect(r.unreachableReason).toBe('The website returned a server error');
    expect(r.status).toBe(502);
    expect(r.rawHtml).toBeNull();
  });

  it('uses the retry result when the second request succeeds', async () => {
    const f = fetcherOf(ok('oops', { status: 500 }), ok('<p>fine</p>'));
    const r = await fetchHomepage('https://example.com/', f);
    expect(f).toHaveBeenCalledTimes(2);
    expect(r.status).toBe(200);
    expect(r.rawHtml).toBe('<p>fine</p>');
  });

  it.each([404, 410])('reports %i as homepage not found', async (status) => {
    const r = await fetchHomepage('https://example.com/', fetcherOf(ok('gone', { status })));
    expect(r.status).toBe(status);
    expect(r.unreachableReason).toBe('The homepage was not found');
    expect(r.rawHtml).toBeNull();
  });

  it('returns contentType and leaves rawHtml null for non-HTML responses', async () => {
    const r = await fetchHomepage('https://example.com/', fetcherOf(ok('%PDF-1.7 text', { contentType: 'application/pdf' })));
    expect(r.contentType).toBe('application/pdf');
    expect(r.rawHtml).toBeNull();
    expect(r.blockReason).toBe('The homepage is not an HTML page');
    expect(r.blocked).toBe(false);
  });

  it('accepts application/xhtml+xml as HTML', async () => {
    const r = await fetchHomepage('https://example.com/', fetcherOf(ok('<html/>', { contentType: 'application/xhtml+xml' })));
    expect(r.rawHtml).toBe('<html/>');
  });

  it('treats a body with NUL bytes as unreadable', async () => {
    const r = await fetchHomepage('https://example.com/', fetcherOf(ok('<html>\u0000\u0001\u0002</html>')));
    expect(r.rawHtml).toBeNull();
    expect(r.blockReason).toBe('The page content could not be read');
    expect(r.blocked).toBe(false);
  });

  it('flags >5 MB pages as unable (reason "Page too large to analyse")', async () => {
    const r = await fetchHomepage('https://example.com/', fetcherOf(failure('too_large')));
    expect(r.blockReason).toBe('Page too large to analyse');
    expect(r.blocked).toBe(false);
    expect(r.unreachableReason).toBeUndefined();
    expect(r.rawHtml).toBeNull();
  });
});

describe('checkHttpRedirect', () => {
  it('returns true when http ends on https', async () => {
    const f = fetcherOf(ok('', { finalUrl: 'https://example.com/' }));
    expect(await checkHttpRedirect('https://example.com/', f)).toBe(true);
    expect(f).toHaveBeenCalledWith('http://example.com/', expect.objectContaining({ maxRedirects: 5 }));
  });

  it('returns false when http stays on http', async () => {
    expect(await checkHttpRedirect('https://example.com/', fetcherOf(ok('', { finalUrl: 'http://example.com/' })))).toBe(false);
  });

  it.each([403, 429, 503])('returns null when the http probe answers %i on http', async (status) => {
    expect(await checkHttpRedirect('https://example.com/', fetcherOf(ok('', { status, finalUrl: 'http://example.com/' })))).toBeNull();
  });

  it('returns false when http answers 200 without a redirect to https', async () => {
    expect(await checkHttpRedirect('https://example.com/', fetcherOf(ok('', { status: 200, finalUrl: 'http://example.com/' })))).toBe(false);
  });

  it('returns null on error', async () => {
    expect(await checkHttpRedirect('https://example.com/', fetcherOf(failure('network')))).toBeNull();
  });

  it('returns null and makes no request when the final URL is not https', async () => {
    const f = fetcherOf(ok(''));
    expect(await checkHttpRedirect('http://example.com/', f)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});

describe('fetchFavicon', () => {
  const html = '<head><link rel="shortcut icon" href="/f.png"></head>';

  it('detects a link tag and reads the /favicon.ico status', async () => {
    const f = fetcherOf(ok('', { status: 200, contentType: 'image/x-icon' }));
    expect(await fetchFavicon('https://example.com', html, f)).toEqual({ linkTag: true, icoStatus: 200 });
    expect(f).toHaveBeenCalledWith('https://example.com/favicon.ico', expect.objectContaining({ method: 'HEAD' }));
  });

  it('reports no link tag and a 404 ico', async () => {
    const f = fetcherOf(ok('', { status: 404 }));
    expect(await fetchFavicon('https://example.com', '<head></head>', f)).toEqual({ linkTag: false, icoStatus: 404 });
  });

  it('does not treat apple-touch-icon alone as an icon link', async () => {
    const f = fetcherOf(ok('', { status: 404 }));
    const r = await fetchFavicon('https://example.com', '<link rel="apple-touch-icon" href="/a.png">', f);
    expect(r.linkTag).toBe(false);
  });

  it('falls back to GET when HEAD is not allowed', async () => {
    const f = fetcherOf(ok('', { status: 405 }), ok('', { status: 200, contentType: 'image/x-icon' }));
    expect((await fetchFavicon('https://example.com', html, f)).icoStatus).toBe(200);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('reports a 200 text/html answer (soft 404) as icoStatus 404', async () => {
    const f = fetcherOf(ok('<html>app</html>', { status: 200, contentType: 'text/html; charset=utf-8' }));
    expect((await fetchFavicon('https://example.com', html, f)).icoStatus).toBe(404);
  });

  it('keeps the real status for a 200 image/x-icon answer', async () => {
    const f = fetcherOf(ok('', { status: 200, contentType: 'image/x-icon' }));
    expect((await fetchFavicon('https://example.com', html, f)).icoStatus).toBe(200);
  });

  it('returns icoStatus null on error', async () => {
    expect((await fetchFavicon('https://example.com', html, fetcherOf(failure('timeout')))).icoStatus).toBeNull();
  });

  it('reports no link tag when there is no html', async () => {
    expect((await fetchFavicon('https://example.com', null, fetcherOf(ok('', { status: 404 })))).linkTag).toBe(false);
  });
});

describe('fetchLlmsTxt', () => {
  it('is present for 200 text/plain', async () => {
    expect(await fetchLlmsTxt('https://example.com', fetcherOf(ok('# Site', { contentType: 'text/plain' })))).toEqual({ present: true });
  });

  it('is present for 200 text/markdown', async () => {
    expect(await fetchLlmsTxt('https://example.com', fetcherOf(ok('# Site', { contentType: 'text/markdown; charset=utf-8' })))).toEqual({ present: true });
  });

  it('is absent for 404', async () => {
    expect(await fetchLlmsTxt('https://example.com', fetcherOf(ok('nope', { status: 404 })))).toEqual({ present: false });
  });

  it('is absent when a 200 answer is an HTML page', async () => {
    expect(await fetchLlmsTxt('https://example.com', fetcherOf(ok('<html></html>')))).toEqual({ present: false });
  });

  it('is null on error', async () => {
    expect(await fetchLlmsTxt('https://example.com', fetcherOf(failure('network')))).toEqual({ present: null });
  });

  it('is null on a server error', async () => {
    expect(await fetchLlmsTxt('https://example.com', fetcherOf(ok('x', { status: 500 })))).toEqual({ present: null });
  });
});

describe('homepageIssue', () => {
  const base = { status: 200, blocked: false, contentType: null, headers: {}, redirectChain: [], rawHtml: null, finalUrl: 'https://example.com/' };

  it('returns null for a readable homepage', async () => {
    const { homepageIssue } = await import('@/lib/gather/direct');
    expect(homepageIssue({ ...base, rawHtml: '<html></html>' })).toBeNull();
  });

  it('maps each failure to a code', async () => {
    const { homepageIssue, fetchHomepage } = await import('@/lib/gather/direct');
    const fail = (reason: 'timeout' | 'too_large' | 'blocked_address' | 'network') =>
      vi.fn().mockResolvedValue({ ok: false, reason, message: 'x' });
    expect(homepageIssue(await fetchHomepage('https://example.com/', fail('too_large')))).toBe('too_large');
    expect(homepageIssue(await fetchHomepage('https://example.com/', fail('timeout')))).toBe('homepage_blocked');
    expect(homepageIssue(await fetchHomepage('https://example.com/', fail('network')))).toBe('homepage_unreachable');
    const html = (status: number, type: string, body = 'x') =>
      vi.fn().mockResolvedValue({ ok: true, status, finalUrl: 'https://example.com/', redirectChain: [], headers: { 'content-type': type }, body, truncated: false });
    expect(homepageIssue(await fetchHomepage('https://example.com/', html(403, 'text/html')))).toBe('homepage_blocked');
    expect(homepageIssue(await fetchHomepage('https://example.com/', html(404, 'text/html')))).toBe('homepage_unreachable');
    expect(homepageIssue(await fetchHomepage('https://example.com/', html(200, 'application/pdf')))).toBe('non_html');
    expect(homepageIssue(await fetchHomepage('https://example.com/', html(200, 'text/html', '\u0000bin')))).toBe('non_html');
  });
});

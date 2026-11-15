import { describe, it, expect, vi } from 'vitest';
import { fetchHomepage } from '@/lib/gather/direct';
import { runChecks } from '@/lib/checks/run';
import type { SafeFetchResult } from '@/lib/security/safe-fetch';
import type { Finding, PageData } from '@/lib/types';
import { makePage, HEALTHY_HTML } from '../helpers/page';

// Regression tests for milestone review C1. Each scenario goes through fetchHomepage and runChecks together.

const failure = (reason: Extract<SafeFetchResult, { ok: false }>['reason']): SafeFetchResult => ({
  ok: false,
  reason,
  message: 'raw message with 10.0.0.5',
});

const ok = (body: string, finalUrl: string, status = 200): SafeFetchResult => ({
  ok: true,
  status,
  finalUrl,
  redirectChain: [],
  headers: { 'content-type': 'text/html; charset=utf-8' },
  body,
  truncated: false,
});

const fetcherOf = (...results: SafeFetchResult[]) => {
  const fn = vi.fn();
  results.forEach((r) => fn.mockResolvedValueOnce(r));
  fn.mockResolvedValue(results[results.length - 1]);
  return fn;
};

async function scan(
  results: SafeFetchResult[],
  extra: { rendered?: PageData['rendered']; httpRedirectsToHttps?: boolean | null } = {},
): Promise<Finding[]> {
  const { finalUrl, ...homepage } = await fetchHomepage('https://example.com/', fetcherOf(...results));
  const page: PageData = {
    ...makePage(),
    finalUrl,
    homepage,
    rendered: extra.rendered === undefined ? null : extra.rendered,
    loadedWith: extra.rendered ? 'firecrawl' : 'direct-fallback',
    httpRedirectsToHttps: extra.httpRedirectsToHttps === undefined ? null : extra.httpRedirectsToHttps,
  };
  return runChecks(page);
}

const find = (findings: Finding[], id: string) => findings.find((f) => f.checkId === id)!;

describe('site reachable: no false outage (C1)', () => {
  it.each([
    ['a TLS certificate error, and the http:// try is redirected back to the same error', failure('network'), failure('network')],
    ['a connection reset from a firewall', failure('network'), failure('network')],
    ['too many redirects', failure('too_many_redirects'), failure('too_many_redirects')],
    ['a temporary DNS failure', failure('dns_transient'), failure('dns_transient')],
    ['a timeout', failure('timeout'), failure('timeout')],
  ])('%s → unable_to_check and no critical finding', async (_name, first, second) => {
    const findings = await scan([first, second]);
    expect(find(findings, 'site-reachable').status).toBe('unable_to_check');
    expect(findings.filter((f) => f.severity === 'critical')).toEqual([]);
  });

  it('a network failure while Firecrawl loaded the page → unable_to_check', async () => {
    const findings = await scan([failure('network'), failure('network')], { rendered: { html: HEALTHY_HTML } });
    expect(find(findings, 'site-reachable').status).toBe('unable_to_check');
  });

  it('an http-only site: https:// fails, http:// works → reachable, and HTTPS fails with the real final URL', async () => {
    const findings = await scan([failure('network'), ok(HEALTHY_HTML, 'http://example.com/')]);
    expect(find(findings, 'site-reachable').status).toBe('pass');
    const https = find(findings, 'https');
    expect(https).toMatchObject({ status: 'fail', severity: 'critical', evidence: { finalUrl: 'http://example.com/', protocol: 'http:' } });
    // The http:// probe is not run on an http final URL, so it cannot fail falsely.
    expect(find(findings, 'http-redirect').status).toBe('unable_to_check');
  });

  it('https:// fails for our fetcher but Firecrawl loaded it in a browser → HTTPS is unable_to_check, not critical', async () => {
    // Example: a missing intermediate certificate. Browsers repair it, Node does not.
    const findings = await scan([failure('network'), ok(HEALTHY_HTML, 'http://example.com/')], {
      rendered: { html: HEALTHY_HTML },
    });
    expect(find(findings, 'https').status).toBe('unable_to_check');
    expect(find(findings, 'site-reachable').status).toBe('pass');
    expect(findings.filter((f) => f.severity === 'critical')).toEqual([]);
  });

  it('a DNS name that does not exist and no browser render → fail critical', async () => {
    const findings = await scan([failure('dns')]);
    expect(find(findings, 'site-reachable')).toMatchObject({ status: 'fail', severity: 'critical' });
  });

  it('a 404 homepage and no browser render → fail critical', async () => {
    const findings = await scan([ok('gone', 'https://example.com/', 404)]);
    expect(find(findings, 'site-reachable')).toMatchObject({ status: 'fail', severity: 'critical', evidence: { status: 404 } });
  });

  it('a 5xx on two attempts and no browser render → fail critical', async () => {
    const findings = await scan([ok('down', 'https://example.com/', 502), ok('down', 'https://example.com/', 502)]);
    expect(find(findings, 'site-reachable')).toMatchObject({ status: 'fail', severity: 'critical', evidence: { status: 502 } });
  });

  it('never puts the raw error message in a finding', async () => {
    const findings = await scan([failure('network'), failure('network')]);
    expect(JSON.stringify(findings)).not.toContain('10.0.0.5');
  });
});

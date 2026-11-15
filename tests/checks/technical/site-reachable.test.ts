import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/site-reachable';
import { makePage, blockedPage } from '../../helpers/page';

describe('site-reachable', () => {
  it('is a verified technical-seo check', () => {
    expect(check.id).toBe('site-reachable');
    expect(check.category).toBe('technical-seo');
    expect(check.confidence).toBe('verified');
  });

  it('passes for a reachable homepage', () => {
    const r = check.run(makePage());
    expect(r).toMatchObject({ status: 'pass', severity: 'passed', evidence: { status: 200, finalUrl: 'https://example.com/' } });
  });

  it('404 → fail critical with evidence.status 404', () => {
    const r = check.run(
      makePage({ homepage: { status: 404, unreachableReason: 'The homepage was not found', rawHtml: null }, rendered: null }),
    );
    expect(r.status).toBe('fail');
    expect(r.severity).toBe('critical');
    expect(r.evidence).toMatchObject({ status: 404 });
  });

  it('410 → fail critical', () => {
    const r = check.run(
      makePage({ homepage: { status: 410, unreachableReason: 'The homepage was not found', rawHtml: null }, rendered: null }),
    );
    expect(r).toMatchObject({ status: 'fail', severity: 'critical' });
  });

  it('repeated 5xx → fail critical', () => {
    const r = check.run(
      makePage({ homepage: { status: 503, unreachableReason: 'The website returned a server error', rawHtml: null }, rendered: null }),
    );
    expect(r).toMatchObject({ status: 'fail', severity: 'critical', evidence: { status: 503 } });
  });

  it('DNS name not found and no browser render → fail critical with null status', () => {
    const r = check.run(
      makePage({
        homepage: { status: null, unreachableReason: 'The website address could not be found', rawHtml: null },
        rendered: null,
        httpRedirectsToHttps: null,
      }),
    );
    expect(r).toMatchObject({ status: 'fail', severity: 'critical', evidence: { status: null } });
  });

  it('other network failure (TLS, reset, refused, transient DNS, redirects) → unable_to_check, never fail', () => {
    const r = check.run(
      makePage({
        homepage: { status: null, unreachableReason: 'The website could not be reached', rawHtml: null },
        rendered: null,
        httpRedirectsToHttps: null,
      }),
    );
    expect(r.status).toBe('unable_to_check');
    expect(r.severity).toBe('info');
    expect(r.unableReason).toBe('The website could not be reached');
  });

  it.each([
    ['DNS not found', { status: null, unreachableReason: 'The website address could not be found' }],
    ['404', { status: 404, unreachableReason: 'The homepage was not found' }],
    ['repeated 5xx', { status: 503, unreachableReason: 'The website returned a server error' }],
  ])('%s but the browser render loaded the page → unable_to_check', (_name, homepage) => {
    const r = check.run(makePage({ homepage: { ...homepage, rawHtml: null }, rendered: { html: '<html>ok</html>' } }));
    expect(r.status).toBe('unable_to_check');
    expect(r.severity).toBe('info');
  });

  it('404 but the http:// address answered with a page → unable_to_check', () => {
    const r = check.run(
      makePage({
        homepage: { status: 404, unreachableReason: 'The homepage was not found', rawHtml: null },
        rendered: null,
        httpRedirectsToHttps: false,
      }),
    );
    expect(r.status).toBe('unable_to_check');
  });

  it('blocked homepage → unable_to_check, never fail', () => {
    const r = check.run(blockedPage());
    expect(r.status).toBe('unable_to_check');
    expect(r.severity).toBe('info');
    expect(r.unableReason).toBe('This site blocked our automated check');
  });

  it('timeout → unable_to_check', () => {
    const r = check.run(
      makePage({ homepage: { status: null, blocked: true, blockReason: 'The website did not respond in time', rawHtml: null } }),
    );
    expect(r.status).toBe('unable_to_check');
  });

  it('address not allowed → unable_to_check', () => {
    const r = check.run(
      makePage({ homepage: { status: null, unreachableReason: 'The website address is not allowed', rawHtml: null } }),
    );
    expect(r.status).toBe('unable_to_check');
    expect(r.unableReason).toBe('The website address is not allowed');
  });

  it('too large or non-HTML → unable_to_check', () => {
    const r = check.run(makePage({ homepage: { blockReason: 'The homepage is not an HTML page', rawHtml: null } }));
    expect(r.status).toBe('unable_to_check');
  });

  it('unexpected status without a clear outage → unable_to_check', () => {
    const r = check.run(
      makePage({ homepage: { status: 418, unreachableReason: 'The website returned an unexpected response', rawHtml: null } }),
    );
    expect(r.status).toBe('unable_to_check');
  });

  it('an unknown failure reason → unable_to_check, never critical', () => {
    const r = check.run(makePage({ homepage: { status: null, unreachableReason: 'Something else went wrong', rawHtml: null } }));
    expect(r.status).toBe('unable_to_check');
    expect(r.severity).toBe('info');
  });

  it('a 404 reason without a 404 status → unable_to_check', () => {
    const r = check.run(makePage({ homepage: { status: 200, unreachableReason: 'The homepage was not found', rawHtml: null } }));
    expect(r.status).toBe('unable_to_check');
  });
});

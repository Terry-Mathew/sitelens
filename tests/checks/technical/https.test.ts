import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/https';
import { check as httpRedirect } from '@/lib/checks/technical/http-redirect';
import { makePage, blockedPage } from '../../helpers/page';

describe('https', () => {
  it('passes when the final URL is https', () => {
    expect(check.run(makePage())).toMatchObject({ status: 'pass', severity: 'passed', evidence: { finalUrl: 'https://example.com/', protocol: 'https:' } });
  });

  it('fails critical when the final URL is http', () => {
    const r = check.run(makePage({ finalUrl: 'http://example.com/' }));
    expect(r).toMatchObject({ status: 'fail', severity: 'critical', evidence: { finalUrl: 'http://example.com/', protocol: 'http:' } });
  });

  it('is unable_to_check when no response was received', () => {
    const r = check.run(
      makePage({ finalUrl: 'http://example.com/', homepage: { status: null, unreachableReason: 'The website could not be reached', rawHtml: null } }),
    );
    expect(r.status).toBe('unable_to_check');
    expect(r.unableReason).toBe('The website could not be reached');
  });

  const fallbackPage = (cause: 'tls' | 'connect') =>
    makePage({ finalUrl: 'http://example.com/', rendered: null, homepage: { httpFallback: true, httpFallbackCause: cause } });

  it('is unable_to_check when https:// had a certificate problem and only http:// answered', () => {
    expect(check.run(fallbackPage('tls'))).toMatchObject({
      status: 'unable_to_check',
      unableReason: 'The secure address has a certificate problem that our check could not accept',
    });
  });

  it('fails critical when nothing answered on https:// and http:// works', () => {
    expect(check.run(fallbackPage('connect'))).toMatchObject({ status: 'fail', severity: 'critical' });
  });

  it('still evaluates a blocked page that has a final URL', () => {
    expect(check.run(blockedPage()).status).toBe('pass');
  });

  it('typed http:// for a site with working https and no redirect: https passes, http-redirect fails warning', () => {
    // The URL is normalised to https://, so the scan reads the secure page. http:// stays on http://.
    const page = makePage({ inputUrl: 'https://example.com/', finalUrl: 'https://example.com/', httpRedirectsToHttps: false });
    expect(check.run(page).status).toBe('pass');
    expect(httpRedirect.run(page)).toMatchObject({ status: 'fail', severity: 'warning' });
  });
});

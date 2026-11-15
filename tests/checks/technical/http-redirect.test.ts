import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/http-redirect';
import { makePage } from '../../helpers/page';

describe('http-redirect', () => {
  it('passes when http redirects to https', () => {
    expect(check.run(makePage({ httpRedirectsToHttps: true }))).toMatchObject({ status: 'pass', severity: 'passed', evidence: { redirectsToHttps: true } });
  });

  it('fails warning when http stays on http', () => {
    expect(check.run(makePage({ httpRedirectsToHttps: false }))).toMatchObject({ status: 'fail', severity: 'warning', evidence: { redirectsToHttps: false } });
  });

  it('null → unable_to_check', () => {
    const r = check.run(makePage({ httpRedirectsToHttps: null }));
    expect(r.status).toBe('unable_to_check');
    expect(r.severity).toBe('info');
    expect(r.unableReason).toBeTruthy();
  });
});

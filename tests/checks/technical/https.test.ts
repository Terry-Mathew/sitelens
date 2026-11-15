import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/https';
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

  it('still evaluates a blocked page that has a final URL', () => {
    expect(check.run(blockedPage()).status).toBe('pass');
  });
});

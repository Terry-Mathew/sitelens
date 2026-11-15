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
    const r = check.run(makePage({ homepage: { status: 410, unreachableReason: 'The homepage was not found', rawHtml: null } }));
    expect(r).toMatchObject({ status: 'fail', severity: 'critical' });
  });

  it('repeated 5xx → fail critical', () => {
    const r = check.run(makePage({ homepage: { status: 503, unreachableReason: 'The website returned a server error', rawHtml: null } }));
    expect(r).toMatchObject({ status: 'fail', severity: 'critical', evidence: { status: 503 } });
  });

  it('network failure (no status) → fail critical with null status', () => {
    const r = check.run(
      makePage({ homepage: { status: null, unreachableReason: 'The website could not be reached', rawHtml: null } }),
    );
    expect(r).toMatchObject({ status: 'fail', severity: 'critical', evidence: { status: null } });
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

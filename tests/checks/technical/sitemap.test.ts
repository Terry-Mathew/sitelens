import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/sitemap';
import { makePage } from '../../helpers/page';

describe('sitemap', () => {
  it('valid → pass', () => {
    expect(check.run(makePage())).toMatchObject({ status: 'pass', severity: 'passed', evidence: { state: 'valid', url: 'https://example.com/sitemap.xml' }, source: 'sitemap' });
  });

  it('missing → fail warning', () => {
    const r = check.run(makePage({ sitemap: { state: 'missing', url: null } }));
    expect(r).toMatchObject({ status: 'fail', severity: 'warning', evidence: { state: 'missing', url: null } });
  });

  it('invalid → fail warning with url', () => {
    const r = check.run(makePage({ sitemap: { state: 'invalid', url: 'https://example.com/sitemap.xml' } }));
    expect(r).toMatchObject({ status: 'fail', severity: 'warning', evidence: { state: 'invalid', url: 'https://example.com/sitemap.xml' } });
  });

  it('error → unable_to_check', () => {
    const r = check.run(makePage({ sitemap: { state: 'error', url: null } }));
    expect(r.status).toBe('unable_to_check');
    expect(r.unableReason).toBeTruthy();
  });
});

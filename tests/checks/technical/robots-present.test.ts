import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/robots-present';
import { makePage } from '../../helpers/page';

describe('robots-present', () => {
  it('found → observation present true', () => {
    const r = check.run(makePage());
    expect(r).toMatchObject({ status: 'observation', severity: 'info', evidence: { present: true }, source: 'robots' });
  });

  it('missing → observation present false, never fail', () => {
    const r = check.run(makePage({ robots: { state: 'missing', groups: [], sitemaps: [] } }));
    expect(r).toMatchObject({ status: 'observation', severity: 'info', evidence: { present: false } });
  });

  it('error → unable_to_check', () => {
    const r = check.run(makePage({ robots: { state: 'error', groups: [], sitemaps: [] } }));
    expect(r.status).toBe('unable_to_check');
    expect(r.unableReason).toBeTruthy();
  });
});

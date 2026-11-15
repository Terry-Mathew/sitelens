import { describe, expect, it } from 'vitest';
import { performanceFindings } from '@/lib/checks/performance';
import type { PageSpeedOutcome, PageSpeedResult } from '@/lib/performance';

function result(overrides: Partial<PageSpeedResult> = {}, score = 90): PageSpeedResult {
  return {
    fetchedAt: '2026-11-15T10:00:00.000Z',
    strategy: 'mobile',
    lab: {
      scores: { performance: score, accessibility: 90, bestPractices: 90, seo: 90 },
      metrics: { lcpMs: 2000, cls: 0.01, tbtMs: 100, fcpMs: 1000, speedIndexMs: 2000 },
    },
    field: null,
    ...overrides,
  };
}
const ok = (r: PageSpeedResult): PageSpeedOutcome => ({ ok: true, data: r });
const find = (o: PageSpeedOutcome, id: string) => performanceFindings(o).find((f) => f.checkId === id)!;

describe('performanceFindings', () => {
  it('returns the two finding ids with category performance and source pagespeed', () => {
    const findings = performanceFindings(ok(result()));
    expect(findings.map((f) => f.checkId)).toEqual(['lab-performance', 'field-cwv']);
    for (const f of findings) {
      expect(f).toMatchObject({ category: 'performance', confidence: 'verified', source: 'pagespeed' });
    }
  });

  it('lab-performance: score 49 is a warning', () => {
    expect(find(ok(result({}, 49)), 'lab-performance')).toMatchObject({
      status: 'fail',
      severity: 'warning',
      evidence: { score: 49 },
    });
  });

  it('lab-performance: score 50 passes', () => {
    expect(find(ok(result({}, 50)), 'lab-performance')).toMatchObject({
      status: 'pass',
      severity: 'passed',
      evidence: { score: 50 },
    });
  });

  it('field-cwv: field null is unable_to_check with the fixed reason', () => {
    expect(find(ok(result()), 'field-cwv')).toMatchObject({
      status: 'unable_to_check',
      severity: 'info',
      unableReason: 'Google does not have enough real-user data for this site.',
    });
  });

  it('field-cwv: a field block with no metrics is unable_to_check, never a pass', () => {
    expect(find(ok(result({ field: { scope: 'url' } })), 'field-cwv')).toMatchObject({
      status: 'unable_to_check',
      unableReason: 'Google does not have enough real-user data for this site.',
    });
  });

  it('field-cwv: any poor metric is a warning that lists the poor metrics', () => {
    const field = {
      scope: 'origin' as const,
      lcp: { p75: 4500, rating: 'poor' as const },
      inp: { p75: 150, rating: 'good' as const },
      cls: { p75: 0.3, rating: 'poor' as const },
    };
    const f = find(ok(result({ field })), 'field-cwv');
    expect(f).toMatchObject({ status: 'fail', severity: 'warning' });
    // Product rule 2: the finding holds the measured values, not only the names.
    expect(f.evidence).toEqual({
      poor: ['lcp', 'cls'],
      scope: 'origin',
      lcp: { p75: 4500, rating: 'poor' },
      inp: { p75: 150, rating: 'good' },
      cls: { p75: 0.3, rating: 'poor' },
    });
  });

  it('field-cwv: a fail leaves out metrics that Google did not return', () => {
    const field = { scope: 'url' as const, lcp: { p75: 5000, rating: 'poor' as const } };
    const f = find(ok(result({ field })), 'field-cwv');
    expect(f.status).toBe('fail');
    expect(f.evidence).toEqual({ poor: ['lcp'], scope: 'url', lcp: { p75: 5000, rating: 'poor' } });
  });

  it('field-cwv: no poor metric passes, with only the present metrics as evidence', () => {
    const field = {
      scope: 'url' as const,
      lcp: { p75: 2400, rating: 'needs-improvement' as const },
      cls: { p75: 0.05, rating: 'good' as const },
    };
    const f = find(ok(result({ field })), 'field-cwv');
    expect(f).toMatchObject({ status: 'pass', severity: 'passed' });
    expect(f.evidence).toEqual({
      lcp: { p75: 2400, rating: 'needs-improvement' },
      cls: { p75: 0.05, rating: 'good' },
      scope: 'url',
    });
    expect(f.evidence).not.toHaveProperty('inp');
  });

  it('unavailable outcome: both findings are unable_to_check with the reason', () => {
    const findings = performanceFindings({ ok: false, unavailable: 'Google PageSpeed did not respond in time.' });
    expect(findings).toHaveLength(2);
    for (const f of findings) {
      expect(f).toMatchObject({
        status: 'unable_to_check',
        severity: 'info',
        unableReason: 'Google PageSpeed did not respond in time.',
        category: 'performance',
        source: 'pagespeed',
      });
    }
  });
});

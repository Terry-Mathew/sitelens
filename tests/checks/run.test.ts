import { describe, it, expect } from 'vitest';
import { runChecks } from '@/lib/checks/run';
import type { Check, PageData } from '@/lib/types';

const page = {} as PageData;

const fake = (over: Partial<Check> = {}): Check => ({
  id: 'fake',
  category: 'technical-seo',
  confidence: 'verified',
  run: () => ({
    status: 'pass',
    severity: 'passed',
    evidence: { a: { b: 1 } },
    source: 'raw',
  }),
  ...over,
});

describe('runChecks', () => {
  it('maps each check to a finding with checkId and category', () => {
    const [f] = runChecks(page, [fake()]);
    expect(f.checkId).toBe('fake');
    expect(f.category).toBe('technical-seo');
    expect(f.status).toBe('pass');
    expect(f.severity).toBe('passed');
    expect(f.source).toBe('raw');
  });

  it('isolates a throwing check as unable_to_check', () => {
    const boom = fake({
      id: 'boom',
      confidence: 'heuristic',
      run: () => {
        throw new Error('nope');
      },
    });
    const findings = runChecks(page, [boom, fake()]);
    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      checkId: 'boom',
      status: 'unable_to_check',
      severity: 'info',
      confidence: 'heuristic',
      evidence: {},
      source: 'raw',
      unableReason: 'Internal check error',
    });
    expect(findings[1].status).toBe('pass');
  });

  it('preserves registry order', () => {
    const ids = ['c', 'a', 'b'];
    const findings = runChecks(
      page,
      ids.map((id) => fake({ id })),
    );
    expect(findings.map((f) => f.checkId)).toEqual(ids);
  });

  it('copies check.confidence onto the finding', () => {
    const findings = runChecks(page, [
      fake({ id: 'v', confidence: 'verified' }),
      fake({ id: 'h', confidence: 'heuristic' }),
    ]);
    expect(findings.map((f) => f.confidence)).toEqual(['verified', 'heuristic']);
  });

  it('returned findings are frozen (mutating evidence throws in strict mode)', () => {
    const [f] = runChecks(page, [fake()]);
    expect(Object.isFrozen(f)).toBe(true);
    expect(() => {
      (f.evidence as Record<string, unknown>).x = 1;
    }).toThrow(TypeError);
    expect(() => {
      ((f.evidence as { a: { b: number } }).a).b = 2;
    }).toThrow(TypeError);
  });

  it('returns an empty list for the default empty registry', () => {
    expect(runChecks(page)).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/robots-allows';
import { makePage } from '../../helpers/page';

const robots = (groups: { userAgents: string[]; allow?: string[]; disallow?: string[] }[]) => ({
  robots: {
    state: 'found' as const,
    groups: groups.map((g) => ({ userAgents: g.userAgents, allow: g.allow ?? [], disallow: g.disallow ?? [] })),
    sitemaps: [],
  },
});

describe('robots-allows', () => {
  it('passes when only some paths are blocked', () => {
    expect(check.run(makePage()).status).toBe('pass');
  });

  it('Disallow: / under * → critical', () => {
    const r = check.run(makePage(robots([{ userAgents: ['*'], disallow: ['/'] }])));
    expect(r.status).toBe('fail');
    expect(r.severity).toBe('critical');
    expect(r.evidence).toMatchObject({ userAgent: '*', disallow: '/', line: 'Disallow: /' });
    expect(r.source).toBe('robots');
  });

  it('Disallow: /* under * → critical', () => {
    const r = check.run(makePage(robots([{ userAgents: ['*'], disallow: ['/*'] }])));
    expect(r).toMatchObject({ status: 'fail', severity: 'critical', evidence: { disallow: '/*' } });
  });

  it('passes when Allow: / beats the block', () => {
    const r = check.run(makePage(robots([{ userAgents: ['*'], allow: ['/'], disallow: ['/'] }])));
    expect(r.status).toBe('pass');
  });

  it('passes when a named crawler is allowed even though * is blocked', () => {
    const r = check.run(makePage(robots([{ userAgents: ['*'], disallow: ['/'] }, { userAgents: ['googlebot'], disallow: [] }])));
    expect(r.status).toBe('pass');
  });

  it('robots missing → not_applicable', () => {
    const r = check.run(makePage({ robots: { state: 'missing', groups: [], sitemaps: [] } }));
    expect(r.status).toBe('not_applicable');
    expect(r.severity).toBe('info');
  });

  it('robots error → unable_to_check', () => {
    const r = check.run(makePage({ robots: { state: 'error', groups: [], sitemaps: [] } }));
    expect(r.status).toBe('unable_to_check');
  });
});

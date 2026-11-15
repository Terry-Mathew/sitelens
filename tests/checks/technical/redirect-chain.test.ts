import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/redirect-chain';
import { makePage } from '../../helpers/page';

const hops = ['http://example.com/', 'https://example.com/', 'https://www.example.com/'];

describe('redirect-chain', () => {
  it('passes with no redirects', () => {
    expect(check.run(makePage())).toMatchObject({ status: 'pass', severity: 'passed', evidence: { hops: 0, chain: [] } });
  });

  it('passes with 2 redirects', () => {
    const r = check.run(makePage({ homepage: { redirectChain: hops.slice(0, 2) } }));
    expect(r).toMatchObject({ status: 'pass', evidence: { hops: 2 } });
  });

  it('3 hops → opportunity with evidence.chain', () => {
    const r = check.run(makePage({ homepage: { redirectChain: hops } }));
    expect(r.status).toBe('fail');
    expect(r.severity).toBe('opportunity');
    expect(r.evidence).toMatchObject({ hops: 3, chain: hops });
  });

  it('is unable_to_check when no response was received', () => {
    const r = check.run(makePage({ homepage: { status: null, unreachableReason: 'The website could not be reached', rawHtml: null } }));
    expect(r.status).toBe('unable_to_check');
  });
});

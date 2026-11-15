import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/canonical';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const withCanonical = (head: string, finalUrl = 'https://example.com/') => {
  const html = htmlPage(head);
  return makePage({ finalUrl, rendered: { html }, homepage: { rawHtml: html } });
};

describe('canonical', () => {
  it('same host → pass', () => {
    const r = check.run(withCanonical('<link rel="canonical" href="https://example.com/">'));
    expect(r).toMatchObject({ status: 'pass', severity: 'passed', evidence: { canonical: 'https://example.com/' } });
  });

  it('ignores a leading www. when comparing hosts', () => {
    expect(check.run(withCanonical('<link rel="canonical" href="https://www.example.com/">')).status).toBe('pass');
    expect(check.run(withCanonical('<link rel="canonical" href="https://example.com/">', 'https://www.example.com/')).status).toBe('pass');
  });

  it('resolves a relative canonical against the final URL', () => {
    const r = check.run(withCanonical('<link rel="canonical" href="/home">'));
    expect(r.status).toBe('pass');
    expect(r.evidence).toMatchObject({ canonical: '/home', resolved: 'https://example.com/home' });
  });

  it('different host → opportunity, evidence.canonical', () => {
    const r = check.run(withCanonical('<link rel="canonical" href="https://other.com/">'));
    expect(r.status).toBe('fail');
    expect(r.severity).toBe('opportunity');
    expect(r.evidence).toMatchObject({ canonical: 'https://other.com/', canonicalHost: 'other.com', pageHost: 'example.com' });
  });

  it('missing → opportunity', () => {
    const r = check.run(withCanonical(''));
    expect(r).toMatchObject({ status: 'fail', severity: 'opportunity', evidence: { canonical: null } });
  });

  it('empty href → opportunity (missing)', () => {
    expect(check.run(withCanonical('<link rel="canonical" href="">')).severity).toBe('opportunity');
  });

  it('a canonical value that cannot be parsed → unable_to_check', () => {
    const r = check.run(withCanonical('<link rel="canonical" href="http://">'));
    expect(r.status).toBe('unable_to_check');
  });

  it('unable_to_check when the homepage could not be read', () => {
    expect(check.run(blockedPage()).status).toBe('unable_to_check');
  });
});

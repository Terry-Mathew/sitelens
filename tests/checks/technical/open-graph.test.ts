import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/open-graph';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const withHead = (head: string) => {
  const html = htmlPage(head);
  return makePage({ rendered: { html }, homepage: { rawHtml: html } });
};

describe('open-graph', () => {
  it('og:title and og:image present → pass', () => {
    const r = check.run(withHead('<meta property="og:title" content="T"><meta property="og:image" content="https://x.com/i.png">'));
    expect(r).toMatchObject({ status: 'pass', severity: 'passed', evidence: { title: 'T', image: 'https://x.com/i.png', missing: [] } });
  });

  it('missing og:image → opportunity', () => {
    const r = check.run(withHead('<meta property="og:title" content="T">'));
    expect(r.status).toBe('fail');
    expect(r.severity).toBe('opportunity');
    expect(r.evidence).toMatchObject({ title: 'T', image: null, missing: ['og:image'] });
  });

  it('missing both → lists both', () => {
    const r = check.run(withHead('<title>x</title>'));
    expect(r.evidence).toMatchObject({ missing: ['og:title', 'og:image'] });
  });

  it('empty content counts as missing', () => {
    const r = check.run(withHead('<meta property="og:title" content=""><meta property="og:image" content="i.png">'));
    expect(r.evidence).toMatchObject({ missing: ['og:title'] });
  });

  it('unable_to_check when the homepage could not be read', () => {
    expect(check.run(blockedPage()).status).toBe('unable_to_check');
  });
});

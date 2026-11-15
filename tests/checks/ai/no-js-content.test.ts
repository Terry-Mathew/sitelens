import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/ai/no-js-content';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const body = (n: number) => `<main><p>${words(n)}</p></main>`;
const page = (raw: number, rendered: number) =>
  makePage({
    homepage: { rawHtml: htmlPage('<title>x</title>', body(raw)) },
    rendered: { html: htmlPage('<title>x</title>', body(rendered)) },
  });

describe('no-js-content', () => {
  it('raw 40 words, rendered 600 → warning', () => {
    expect(check.run(page(40, 600))).toMatchObject({
      status: 'fail', severity: 'warning', evidence: { rawWords: 40, renderedWords: 600 },
    });
  });

  it('raw 40 words, rendered 100 → pass (ratio is above 30%)', () => {
    expect(check.run(page(40, 100)).status).toBe('pass');
  });

  it('raw 200 words, rendered 2000 → pass (raw is 150 words or more)', () => {
    expect(check.run(page(200, 2000)).status).toBe('pass');
  });

  it('raw equals rendered → pass with evidence', () => {
    expect(check.run(page(300, 300))).toMatchObject({
      status: 'pass', severity: 'passed', evidence: { rawWords: 300, renderedWords: 300 },
    });
  });

  it('fallback with jsRendered → warning with rawWords only', () => {
    const r = check.run(makePage({ rendered: null, loadedWith: 'direct-fallback', jsRendered: true }));
    expect(r).toMatchObject({ status: 'fail', severity: 'warning', source: 'raw' });
    expect(r.evidence).toHaveProperty('rawWords');
    expect(r.evidence).not.toHaveProperty('renderedWords');
  });

  it('fallback without jsRendered → pass with rawWords', () => {
    const r = check.run(makePage({ rendered: null, loadedWith: 'direct-fallback', jsRendered: false }));
    expect(r.status).toBe('pass');
    expect(r.evidence).toHaveProperty('rawWords');
  });

  it('raw HTML missing → unable_to_check', () => {
    expect(check.run(blockedPage()).status).toBe('unable_to_check');
  });

  it('raw HTML missing but rendered present → unable_to_check', () => {
    const r = check.run(makePage({ homepage: { rawHtml: null } }));
    expect(r.status).toBe('unable_to_check');
  });
});

import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/content/heading-order';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const withBody = (body: string) => {
  const html = htmlPage('<title>x</title>', body);
  return makePage({ rendered: { html }, homepage: { rawHtml: html } });
};

describe('heading-order', () => {
  it('H1 then H3 → opportunity, evidence.skip "h1→h3"', () => {
    expect(check.run(withBody('<h1>A</h1><h3>B</h3>'))).toMatchObject({ status: 'fail', severity: 'opportunity', evidence: { skip: 'h1→h3' } });
  });

  it('H1, H2, H3, then back to H2 → passed', () => {
    expect(check.run(withBody('<h1>A</h1><h2>B</h2><h3>C</h3><h2>D</h2>'))).toMatchObject({ status: 'pass', severity: 'passed' });
  });

  it('no headings → not_applicable', () => {
    expect(check.run(withBody('<p>text</p>')).status).toBe('not_applicable');
  });

  it('unable_to_check when the homepage could not be read', () => {
    expect(check.run(blockedPage()).status).toBe('unable_to_check');
  });
});

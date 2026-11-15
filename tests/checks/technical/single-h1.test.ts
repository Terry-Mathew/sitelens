import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/single-h1';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const withBody = (body: string) => {
  const html = htmlPage('<title>x</title>', body);
  return makePage({ rendered: { html }, homepage: { rawHtml: html } });
};

describe('single-h1', () => {
  it('one H1 → pass', () => {
    expect(check.run(withBody('<h1>Welcome</h1>'))).toMatchObject({ status: 'pass', severity: 'passed', evidence: { count: 1, texts: ['Welcome'] } });
  });

  it('zero H1 → warning', () => {
    const r = check.run(withBody('<h2>Welcome</h2>'));
    expect(r).toMatchObject({ status: 'fail', severity: 'warning', evidence: { count: 0, texts: [] } });
  });

  it('two H1 → warning with both texts', () => {
    const r = check.run(withBody('<h1>One</h1><h1> Two </h1>'));
    expect(r).toMatchObject({ status: 'fail', severity: 'warning', evidence: { count: 2, texts: ['One', 'Two'] } });
  });

  it('unable_to_check when the homepage could not be read', () => {
    expect(check.run(blockedPage()).status).toBe('unable_to_check');
  });
});

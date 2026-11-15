import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/html-lang';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const withAttrs = (attrs: string) => {
  const html = htmlPage('<title>x</title>', '<h1>x</h1>', attrs);
  return makePage({ rendered: { html }, homepage: { rawHtml: html } });
};

describe('html-lang', () => {
  it('lang present → pass', () => {
    expect(check.run(withAttrs('lang="en-GB"'))).toMatchObject({ status: 'pass', severity: 'passed', evidence: { lang: 'en-GB' } });
  });

  it('lang missing → opportunity', () => {
    expect(check.run(withAttrs(''))).toMatchObject({ status: 'fail', severity: 'opportunity', evidence: { lang: null } });
  });

  it('empty lang → opportunity', () => {
    expect(check.run(withAttrs('lang=""')).severity).toBe('opportunity');
  });

  it('unable_to_check when the homepage could not be read', () => {
    expect(check.run(blockedPage()).status).toBe('unable_to_check');
  });
});

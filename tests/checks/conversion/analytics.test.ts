import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/conversion/analytics';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const withHead = (head: string, rawHead = head) => {
  const rendered = htmlPage(`<title>x</title>${head}`);
  const raw = htmlPage(`<title>x</title>${rawHead}`);
  return makePage({ rendered: { html: rendered }, homepage: { rawHtml: raw } });
};

describe('analytics', () => {
  it('GTM detected → passed, evidence.tools ["Google Tag Manager"]', () => {
    const r = check.run(withHead('<script src="https://www.googletagmanager.com/gtm.js?id=GTM-X"></script>'));
    expect(r).toMatchObject({ status: 'pass', severity: 'passed', evidence: { tools: ['Google Tag Manager'] } });
  });

  it('detects tools from script src and inline text', () => {
    const head = `
      <script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script>
      <script>!function(){fbq('init','1')}()</script>
      <script src="https://plausible.io/js/script.js"></script>
      <script src="https://cdn.usefathom.com/script.js"></script>
      <script>var _paq = window._paq; u="//cdn.matomo.cloud/";</script>`;
    expect(check.run(withHead(head)).evidence.tools).toEqual([
      'Google Analytics', 'Meta Pixel', 'Plausible', 'Fathom', 'Matomo',
    ]);
  });

  it('detects a tool that is only in the raw HTML', () => {
    const r = check.run(withHead('', '<script src="https://plausible.io/js/a.js"></script>'));
    expect(r.evidence.tools).toEqual(['Plausible']);
  });

  it('detects a tool that is only in the rendered HTML', () => {
    const r = check.run(withHead('<script src="https://plausible.io/js/a.js"></script>', ''));
    expect(r.evidence.tools).toEqual(['Plausible']);
  });

  it('ignores a tool name in page text', () => {
    const html = htmlPage('<title>x</title>', '<p>We use plausible.io and googletagmanager.com/gtm.js</p>');
    const r = check.run(makePage({ rendered: { html }, homepage: { rawHtml: html } }));
    expect(r).toMatchObject({ status: 'fail', severity: 'opportunity', evidence: { tools: [] } });
  });

  it('none → opportunity', () => {
    expect(check.run(withHead(''))).toMatchObject({ status: 'fail', severity: 'opportunity', evidence: { tools: [] } });
  });

  it('unable_to_check when the homepage could not be read', () => {
    expect(check.run(blockedPage()).status).toBe('unable_to_check');
  });
});

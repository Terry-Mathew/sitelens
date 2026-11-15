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

  it.each([
    ['Microsoft Clarity', '<script>(function(c,l,a,r,i,t,y){t.src="https://www.clarity.ms/tag/"+i})()</script>'],
    ['Hotjar', '<script>h._hjSettings={hjid:1};r.src="https://static.hotjar.com/c/hotjar-1.js"</script>'],
    ['HubSpot', '<script src="//js.hs-scripts.com/123.js"></script>'],
    ['Cloudflare Web Analytics', '<script defer src="https://static.cloudflareinsights.com/beacon.min.js"></script>'],
    ['Segment', '<script>t.src="https://cdn.segment.com/analytics.js/v1/"+key</script>'],
  ])('detects %s', (name, head) => {
    expect(check.run(withHead(head))).toMatchObject({ status: 'pass', evidence: { tools: [name] } });
  });

  it.each([
    ['Squarespace', '<link rel="stylesheet" href="https://static1.squarespace.com/static/x/site.css">'],
    ['Wix', '<meta name="generator" content="Wix.com Website Builder">'],
    ['Wix', '<script src="https://static.parastorage.com/services/x.js"></script>'],
    ['Shopify', '<script src="https://cdn.shopify.com/s/files/1/theme.js"></script>'],
    ['Shopify', '<meta name="generator" content="Shopify">'],
  ])('a %s site with no listed tool → unable_to_check with the platform reason', (platform, head) => {
    const r = check.run(withHead(head));
    expect(r).toMatchObject({
      status: 'unable_to_check',
      unableReason: `This site uses ${platform}, which includes built-in visitor statistics.`,
    });
    expect(r.evidence).not.toHaveProperty('tools', [platform]);
  });

  it('a website-builder site with a listed tool → pass, and the platform is not a tool', () => {
    const head = '<link href="https://static1.squarespace.com/a.css" rel="stylesheet"><script src="https://plausible.io/js/a.js"></script>';
    expect(check.run(withHead(head))).toMatchObject({ status: 'pass', evidence: { tools: ['Plausible'] } });
  });
});

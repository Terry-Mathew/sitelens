import { describe, it, expect } from 'vitest';
import { checks } from '@/lib/checks/registry';
import { runChecks } from '@/lib/checks/run';
import type { PageData } from '@/lib/types';
import { makePage, blockedPage, htmlPage } from '../helpers/page';

const CRITICAL_ALLOWED = new Set(['site-reachable', 'https', 'indexable', 'robots-allows']);
const HEURISTIC = new Set([
  'word-count',
  'contact-method',
  'click-to-call',
  'cta',
  'analytics',
  'machine-readable-contact',
  'no-js-content',
  'heading-order',
  'copyright-year',
]);
// These checks read inputs other than the homepage HTML, so they can fail when the HTML is null.
const NON_HTML_INPUTS = new Set([
  'site-reachable',
  'https',
  'http-redirect',
  'redirect-chain',
  'robots-present',
  'robots-allows',
  'sitemap',
  'favicon',
  'indexable',
]);

const bareHtml = htmlPage('', '<p>hi</p>', '');

const fixtures: Record<string, PageData> = {
  healthy: makePage(),
  blocked: blockedPage(),
  unreachable404: makePage({
    homepage: { status: 404, unreachableReason: 'The homepage was not found', rawHtml: null },
    rendered: null,
    httpRedirectsToHttps: null,
    robots: { state: 'error', groups: [], sitemaps: [] },
    sitemap: { state: 'error', url: null },
    favicon: { linkTag: false, icoStatus: null },
  }),
  bareNoTags: makePage({ rendered: { html: bareHtml }, homepage: { rawHtml: bareHtml } }),
  nonHtml: makePage({
    homepage: { rawHtml: null, blockReason: 'The homepage is not an HTML page', contentType: 'application/pdf' },
    rendered: null,
  }),
  jsShellFallback: makePage({
    rendered: null,
    loadedWith: 'direct-fallback',
    jsRendered: true,
    homepage: { rawHtml: '<html><body><div id="root"></div></body></html>' },
  }),
};

describe('severity discipline', () => {
  it('no heuristic check ever returns critical', () => {
    for (const [name, page] of Object.entries(fixtures)) {
      const findings = runChecks(page);
      for (const f of findings.filter((x) => HEURISTIC.has(x.checkId))) {
        expect(f.severity, `${name}/${f.checkId}`).not.toBe('critical');
        expect(f.confidence, f.checkId).toBe('heuristic');
      }
    }
  });

  it('registers the content and conversion heuristic checks', () => {
    const ids = checks.filter((c) => ['content', 'conversion'].includes(c.category)).map((c) => c.id);
    expect(ids.sort()).toEqual(
      ['word-count', 'copyright-year', 'heading-order', 'contact-method', 'click-to-call', 'cta', 'analytics'].sort(),
    );
    checks.filter((c) => ids.includes(c.id)).forEach((c) => expect(c.confidence).toBe('heuristic'));
  });

  it('critical is used only by the four allowed checks', () => {
    for (const [name, page] of Object.entries(fixtures)) {
      for (const f of runChecks(page).filter((x) => x.severity === 'critical')) {
        expect(CRITICAL_ALLOWED.has(f.checkId), `${name}/${f.checkId}`).toBe(true);
      }
    }
  });

  it('a page with no HTML never gives a fail from an HTML check', () => {
    for (const name of ['blocked', 'nonHtml']) {
      for (const f of runChecks(fixtures[name])) {
        if (f.status === 'fail') expect(NON_HTML_INPUTS.has(f.checkId), `${name}/${f.checkId}`).toBe(true);
      }
    }
  });

  it('a blocked page gives unable_to_check for every HTML check', () => {
    for (const f of runChecks(fixtures.blocked)) {
      if (!NON_HTML_INPUTS.has(f.checkId)) {
        expect(f.status, f.checkId).toBe('unable_to_check');
        expect(f.unableReason, f.checkId).toBeTruthy();
      }
    }
  });

  it('observations and unable results never carry a warning or critical severity', () => {
    for (const page of Object.values(fixtures)) {
      for (const f of runChecks(page)) {
        if (['observation', 'unable_to_check', 'not_applicable'].includes(f.status)) expect(f.severity).toBe('info');
        if (f.status === 'pass') expect(f.severity).toBe('passed');
      }
    }
  });

  it('every check returns fresh evidence on each run', () => {
    const page = fixtures.healthy;
    const a = runChecks(page);
    const b = runChecks(page);
    a.forEach((f, i) => expect(f.evidence).not.toBe(b[i].evidence));
  });

  it('registers each check id once', () => {
    const ids = checks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('registers the 17 technical and SEO checks', () => {
    const ids = checks.filter((c) => c.category === 'technical-seo').map((c) => c.id);
    expect(ids.sort()).toEqual(
      [
        'site-reachable', 'https', 'http-redirect', 'redirect-chain', 'indexable', 'robots-present',
        'robots-allows', 'sitemap', 'title', 'meta-description', 'single-h1', 'canonical', 'html-lang',
        'viewport', 'img-alt', 'open-graph', 'favicon',
      ].sort(),
    );
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PageData } from '@/lib/types';

vi.mock('@/lib/gather/firecrawl', () => ({ scrapeRendered: vi.fn() }));
vi.mock('@/lib/gather/direct', () => ({
  fetchHomepage: vi.fn(),
  checkHttpRedirect: vi.fn(),
  fetchFavicon: vi.fn(),
  fetchLlmsTxt: vi.fn(),
  homepageIssue: vi.fn(),
}));
vi.mock('@/lib/gather/robots', () => ({ fetchRobots: vi.fn() }));
vi.mock('@/lib/gather/sitemap', () => ({ fetchSitemap: vi.fn() }));

import { scrapeRendered } from '@/lib/gather/firecrawl';
import { fetchHomepage, checkHttpRedirect, fetchFavicon, fetchLlmsTxt, homepageIssue } from '@/lib/gather/direct';
import { fetchRobots } from '@/lib/gather/robots';
import { fetchSitemap } from '@/lib/gather/sitemap';
import { gather } from '@/lib/gather';

const URL_IN = 'https://example.com/';
const NOW = new Date('2026-11-15T10:00:00.000Z');
const SHELL = '<html><body><div id="root"></div><script src="/app.js"></script></body></html>';
const REAL = `<html><body><h1>Hi</h1><p>${'word '.repeat(300)}</p></body></html>`;

const homepage = (over: Partial<PageData['homepage'] & { finalUrl: string }> = {}) => ({
  status: 200,
  blocked: false,
  contentType: 'text/html',
  headers: {},
  redirectChain: [],
  rawHtml: REAL,
  finalUrl: 'https://www.example.com/',
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(scrapeRendered).mockResolvedValue({ html: '<html>rendered</html>' });
  vi.mocked(fetchHomepage).mockResolvedValue(homepage());
  vi.mocked(checkHttpRedirect).mockResolvedValue(true);
  vi.mocked(fetchFavicon).mockResolvedValue({ linkTag: true, icoStatus: 200 });
  vi.mocked(fetchLlmsTxt).mockResolvedValue({ present: false });
  vi.mocked(fetchRobots).mockResolvedValue({ state: 'found', groups: [], sitemaps: ['https://example.com/s.xml'] });
  vi.mocked(fetchSitemap).mockResolvedValue({ state: 'valid', url: 'https://example.com/s.xml', isIndex: false });
  vi.mocked(homepageIssue).mockReturnValue(null);
});

const run = () => gather(URL_IN, () => NOW);

describe('gather', () => {
  it('uses Firecrawl HTML and sets loadedWith "firecrawl"', async () => {
    const page = await run();
    expect(page.rendered).toEqual({ html: '<html>rendered</html>' });
    expect(page.loadedWith).toBe('firecrawl');
    expect(page.inputUrl).toBe(URL_IN);
    expect(page.finalUrl).toBe('https://www.example.com/');
    expect(page.scannedAt).toBe(NOW.toISOString());
    expect(page.httpRedirectsToHttps).toBe(true);
    expect(page.limitations).toEqual([]);
  });

  it('falls back to direct when Firecrawl returns null (no key, error or timeout)', async () => {
    vi.mocked(scrapeRendered).mockResolvedValue(null);
    const page = await run();
    expect(page.rendered).toBeNull();
    expect(page.loadedWith).toBe('direct-fallback');
    expect(page.limitations).toEqual(['firecrawl_unavailable']);
  });

  it('sets jsRendered from looksLikeJsShell(rawHtml)', async () => {
    vi.mocked(fetchHomepage).mockResolvedValue(homepage({ rawHtml: SHELL }));
    expect((await run()).jsRendered).toBe(true);
    vi.mocked(fetchHomepage).mockResolvedValue(homepage({ rawHtml: REAL }));
    expect((await run()).jsRendered).toBe(false);
    vi.mocked(fetchHomepage).mockResolvedValue(homepage({ rawHtml: null }));
    expect((await run()).jsRendered).toBe(false);
  });

  it('runs independent fetches in parallel and passes dependencies on', async () => {
    const started: string[] = [];
    const gates: Array<() => void> = [];
    const slow = <T,>(name: string, value: T) =>
      vi.fn(() => {
        started.push(name);
        return new Promise<T>((resolve) => gates.push(() => resolve(value)));
      });
    vi.mocked(scrapeRendered).mockImplementation(slow('firecrawl', { html: 'x' }));
    vi.mocked(fetchHomepage).mockImplementation(slow('homepage', homepage()));
    vi.mocked(fetchRobots).mockImplementation(slow('robots', { state: 'found' as const, groups: [], sitemaps: ['https://example.com/s.xml'] }));
    vi.mocked(fetchLlmsTxt).mockImplementation(slow('llms', { present: false }));

    const pending = run();
    await Promise.resolve();
    // All four first-stage calls start before any one finishes.
    expect(started.sort()).toEqual(['firecrawl', 'homepage', 'llms', 'robots']);
    gates.splice(0).forEach((open) => open());
    await vi.waitFor(() => expect(fetchSitemap).toHaveBeenCalled());
    await pending;

    expect(fetchSitemap).toHaveBeenCalledWith('https://www.example.com', ['https://example.com/s.xml']);
    expect(checkHttpRedirect).toHaveBeenCalledWith('https://www.example.com/');
    expect(fetchFavicon).toHaveBeenCalledWith('https://www.example.com', REAL);
  });

  it('still returns PageData when the homepage is blocked', async () => {
    vi.mocked(fetchHomepage).mockResolvedValue(
      homepage({ blocked: true, blockReason: 'This site blocked our automated check', rawHtml: null, status: 403 }),
    );
    vi.mocked(homepageIssue).mockReturnValue('homepage_blocked');
    const page = await run();
    expect(page.homepage.blocked).toBe(true);
    expect(page.rendered).not.toBeNull();
    expect(page.limitations).toEqual(['homepage_blocked']);
  });

  it('uses inputUrl as finalUrl when the homepage is unreachable', async () => {
    vi.mocked(fetchHomepage).mockResolvedValue(
      homepage({ rawHtml: null, status: null, unreachableReason: 'The website could not be reached', finalUrl: URL_IN }),
    );
    vi.mocked(homepageIssue).mockReturnValue('homepage_unreachable');
    const page = await run();
    expect(page.finalUrl).toBe(URL_IN);
    expect(page.limitations).toEqual(['homepage_unreachable']);
  });

  it('maps non-html and too-large homepages to their limitation codes', async () => {
    vi.mocked(homepageIssue).mockReturnValue('non_html');
    expect((await run()).limitations).toEqual(['non_html']);
    vi.mocked(homepageIssue).mockReturnValue('too_large');
    expect((await run()).limitations).toEqual(['too_large']);
  });

  it('builds limitations in stable order without duplicates', async () => {
    vi.mocked(scrapeRendered).mockResolvedValue(null);
    vi.mocked(fetchHomepage).mockResolvedValue(homepage({ rawHtml: SHELL }));
    vi.mocked(fetchRobots).mockResolvedValue({ state: 'error', groups: [], sitemaps: [] });
    vi.mocked(fetchSitemap).mockResolvedValue({ state: 'error', url: null, isIndex: false });
    const page = await run();
    expect(page.limitations).toEqual(['firecrawl_unavailable', 'js_fallback', 'robots_unavailable', 'sitemap_unavailable']);
    expect(new Set(page.limitations).size).toBe(page.limitations.length);
  });

  it('does not flag js_fallback when Firecrawl worked', async () => {
    vi.mocked(fetchHomepage).mockResolvedValue(homepage({ rawHtml: SHELL }));
    expect((await run()).limitations).toEqual([]);
  });

  it('does not send a non-http URL to Firecrawl', async () => {
    await expect(gather('ftp://example.com/', () => NOW)).rejects.toThrow();
    expect(scrapeRendered).not.toHaveBeenCalled();
  });

  it('degrades instead of rejecting when a fetch throws unexpectedly', async () => {
    vi.mocked(fetchSitemap).mockRejectedValue(new Error('x'));
    vi.mocked(checkHttpRedirect).mockRejectedValue(new Error('x'));
    vi.mocked(fetchFavicon).mockRejectedValue(new Error('x'));
    vi.mocked(fetchRobots).mockRejectedValue(new Error('x'));
    vi.mocked(fetchLlmsTxt).mockRejectedValue(new Error('x'));
    const page = await run();
    expect(page.sitemap).toEqual({ state: 'error', url: null, isIndex: false });
    expect(page.httpRedirectsToHttps).toBeNull();
    expect(page.favicon).toEqual({ linkTag: false, icoStatus: null });
    expect(page.robots).toEqual({ state: 'error', groups: [], sitemaps: [] });
    expect(page.llmsTxt).toEqual({ present: null });
    expect(page.limitations).toEqual(['robots_unavailable', 'sitemap_unavailable']);
  });
});

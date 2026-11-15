import type { LimitationCode, PageData } from '@/lib/types';
import { looksLikeJsShell } from '@/lib/html';
import { scrapeRendered } from '@/lib/gather/firecrawl';
import { checkHttpRedirect, fetchFavicon, fetchHomepage, fetchLlmsTxt, homepageIssue } from '@/lib/gather/direct';
import { fetchRobots } from '@/lib/gather/robots';
import { fetchSitemap } from '@/lib/gather/sitemap';

function buildLimitations(
  page: Pick<PageData, 'rendered' | 'homepage' | 'robots' | 'sitemap' | 'loadedWith' | 'jsRendered'>,
): LimitationCode[] {
  const issue = homepageIssue(page.homepage);
  const list: Array<LimitationCode | null> = [
    page.rendered === null ? 'firecrawl_unavailable' : null,
    issue,
    page.loadedWith === 'direct-fallback' && page.jsRendered ? 'js_fallback' : null,
    page.robots.state === 'error' ? 'robots_unavailable' : null,
    page.sitemap.state === 'error' ? 'sitemap_unavailable' : null,
  ];
  return [...new Set(list.filter((code): code is LimitationCode => code !== null))];
}

/**
 * Does all network work for one scan and returns the data the checks read.
 * The URL must already be validated by the caller.
 */
export async function gather(inputUrl: string, now: () => Date = () => new Date()): Promise<PageData> {
  const { protocol, origin: inputOrigin } = new URL(inputUrl);
  if (protocol !== 'https:' && protocol !== 'http:') throw new Error('gather needs an http(s) URL');

  // These four calls do not depend on each other.
  const [homepage, rendered, robots, llmsTxt] = await Promise.all([
    fetchHomepage(inputUrl),
    scrapeRendered(inputUrl),
    fetchRobots(inputOrigin),
    fetchLlmsTxt(inputOrigin),
  ]);

  // A failed fetch already sets finalUrl to the input URL.
  const finalUrl = homepage.finalUrl;
  const origin = new URL(finalUrl).origin;

  // These need the homepage or robots result.
  const [sitemap, httpRedirectsToHttps, favicon] = await Promise.all([
    fetchSitemap(origin, robots.sitemaps),
    checkHttpRedirect(finalUrl),
    fetchFavicon(origin, homepage.rawHtml),
  ]);

  const loadedWith: PageData['loadedWith'] = rendered ? 'firecrawl' : 'direct-fallback';
  const jsRendered = homepage.rawHtml ? looksLikeJsShell(homepage.rawHtml) : false;
  const { finalUrl: _ignored, ...homepageData } = homepage;
  void _ignored;

  const page = {
    inputUrl,
    finalUrl,
    scannedAt: now().toISOString(),
    homepage: homepageData,
    httpRedirectsToHttps,
    rendered,
    robots,
    sitemap,
    favicon,
    llmsTxt,
    jsRendered,
    loadedWith,
  };
  return { ...page, limitations: buildLimitations(page) };
}

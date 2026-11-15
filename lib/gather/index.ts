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
    // For a non-HTML homepage, the non_html limitation already explains the missing render.
    page.rendered === null && issue !== 'non_html' ? 'firecrawl_unavailable' : null,
    issue,
    page.loadedWith === 'direct-fallback' && page.jsRendered ? 'js_fallback' : null,
    page.robots.state === 'error' ? 'robots_unavailable' : null,
    page.sitemap.state === 'error' ? 'sitemap_unavailable' : null,
  ];
  return [...new Set(list.filter((code): code is LimitationCode => code !== null))];
}

/** Runs one fetch and returns a fallback value if it throws, so one failure cannot reject the scan. */
async function guarded<T>(task: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await task();
  } catch {
    return fallback;
  }
}

/**
 * Does all network work for one scan and returns the data the checks read.
 * The URL must already be validated by the caller.
 */
export async function gather(inputUrl: string, now: () => Date = () => new Date()): Promise<PageData> {
  const { protocol, origin: inputOrigin } = new URL(inputUrl);
  if (protocol !== 'https:' && protocol !== 'http:') throw new Error('gather needs an http(s) URL');

  // These four calls do not depend on each other.
  // Robots and llms.txt use the input origin because the final URL is not known yet.
  const homepageTask = fetchHomepage(inputUrl);
  const renderedTask = scrapeRendered(inputUrl);
  const robotsTask = guarded(() => fetchRobots(inputOrigin), { state: 'error' as const, groups: [], sitemaps: [] });
  const llmsTask = guarded(() => fetchLlmsTxt(inputOrigin), { present: null });

  // The second stage needs the homepage (and robots for the sitemap). It does not wait for Firecrawl.
  const secondStage = homepageTask.then((homepage) => {
    // A failed fetch already sets finalUrl to the input URL.
    const origin = new URL(homepage.finalUrl).origin;
    return Promise.all([
      robotsTask.then((robots) =>
        guarded(() => fetchSitemap(origin, robots.sitemaps), { state: 'error' as const, url: null, isIndex: false }),
      ),
      guarded(() => checkHttpRedirect(homepage.finalUrl), null),
      guarded(() => fetchFavicon(origin), { icoStatus: null }),
    ]);
  });

  const [homepage, scraped, robots, llmsTxt, [sitemap, httpRedirectsToHttps, favicon]] = await Promise.all([
    homepageTask,
    renderedTask,
    robotsTask,
    llmsTask,
    secondStage,
  ]);
  const finalUrl = homepage.finalUrl;
  // A browser copy of a PDF or other non-HTML file is not a web page. Do not grade it.
  const rendered = homepageIssue(homepage) === 'non_html' ? null : scraped;

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

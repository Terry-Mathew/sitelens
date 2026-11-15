import { Firecrawl } from '@mendable/firecrawl-js';
import { hasChallengeMarker, loadHtml, visibleText, wordCount } from '@/lib/html';

const FIRECRAWL_TIMEOUT_MS = 30_000;
// Spec 8.3 caps the direct fetch at 5 MB. The rendered copy has the same cap.
const MAX_HTML_BYTES = 5 * 1024 * 1024;
// A challenge page has little text. A normal page can load the Cloudflare script and still be real.
const CHALLENGE_WORD_LIMIT = 100;

/** True if the rendered HTML is a bot challenge page and not the real site. */
function isChallengePage(html: string): boolean {
  return hasChallengeMarker(html) && wordCount(visibleText(loadHtml(html))) < CHALLENGE_WORD_LIMIT;
}

function isHttpUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Loads the page in a real browser through Firecrawl and returns the rendered HTML.
 * Returns null for a missing key, an error, an empty page, a timeout, a page over 5 MB,
 * or a bot challenge page.
 * Nothing is logged, because the message could hold the scanned URL or the key.
 */
export async function scrapeRendered(url: string): Promise<{ html: string } | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;
  if (!isHttpUrl(url)) return null;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const client = new Firecrawl({ apiKey });
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), FIRECRAWL_TIMEOUT_MS);
    });
    // "rawHtml" is the full page after rendering. "html" is cleaned and can drop head tags.
    const scrape = client.scrape(url, {
      formats: ['rawHtml'],
      onlyMainContent: false,
      timeout: FIRECRAWL_TIMEOUT_MS,
    });
    // Stop an unhandled rejection if the timeout wins the race.
    scrape.catch(() => undefined);
    const doc = await Promise.race([scrape, timeout]);
    // An error or challenge page is not the real site. Treat it as rendering unavailable.
    const status = doc?.metadata?.statusCode;
    if (typeof status === 'number' && (status < 200 || status >= 300)) return null;
    const html = doc?.rawHtml;
    if (typeof html !== 'string' || html.trim() === '') return null;
    if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) return null;
    // Firecrawl can get a challenge page with status 200. That page is not the real site.
    if (isChallengePage(html)) return null;
    return { html };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

import { Firecrawl } from '@mendable/firecrawl-js';

const FIRECRAWL_TIMEOUT_MS = 30_000;

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
 * Returns null for a missing key, an error, an empty page, or a timeout.
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
    const html = doc?.rawHtml;
    return typeof html === 'string' && html.trim() !== '' ? { html } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

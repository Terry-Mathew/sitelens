import type { LimitationCode, PageData } from '@/lib/types';
import { safeFetch, type SafeFetchResult } from '@/lib/security/safe-fetch';
import { loadHtml } from '@/lib/html';

type Fetcher = typeof safeFetch;
type Homepage = PageData['homepage'] & { finalUrl: string };

const HOMEPAGE_TIMEOUT_MS = 10_000;
const HOMEPAGE_MAX_BYTES = 5 * 1024 * 1024;
const SMALL_TIMEOUT_MS = 5000;
const SMALL_MAX_BYTES = 500 * 1024;
const MAX_REDIRECTS = 5;

const BLOCKED_STATUSES = new Set([401, 403, 429]);
const CHALLENGE_MARKERS = ['cf-chl', 'challenge-platform', 'just a moment...'];

// Fixed text only. The raw message from safeFetch can contain IP addresses.
export const REASON = {
  blocked: 'This site blocked our automated check',
  unreachable: 'The website could not be reached',
  timeout: 'The website did not respond in time',
  tooLarge: 'Page too large to analyse',
  notAllowed: 'The website address is not allowed',
  serverError: 'The website returned a server error',
  notFound: 'The homepage was not found',
  notHtml: 'The homepage is not an HTML page',
  unreadable: 'The page content could not be read',
  unexpected: 'The website returned an unexpected response',
} as const;

const emptyHomepage = (finalUrl: string): Homepage => ({
  status: null,
  blocked: false,
  contentType: null,
  headers: {},
  redirectChain: [],
  rawHtml: null,
  finalUrl,
});

type Success = Extract<SafeFetchResult, { ok: true }>;

function isChallengePage(result: Success): boolean {
  if (result.status !== 403 && result.status !== 503) return false;
  const body = result.body.toLowerCase();
  return CHALLENGE_MARKERS.some((marker) => body.includes(marker));
}

function fromFailure(url: string, reason: Extract<SafeFetchResult, { ok: false }>['reason']): Homepage {
  const base = emptyHomepage(url);
  switch (reason) {
    case 'timeout':
      // A timeout does not prove the site is down. Later checks treat it as unable to check.
      return { ...base, blocked: true, blockReason: REASON.timeout };
    case 'too_large':
      return { ...base, blockReason: REASON.tooLarge };
    case 'blocked_address':
      return { ...base, unreachableReason: REASON.notAllowed };
    default:
      return { ...base, unreachableReason: REASON.unreachable };
  }
}

function fromResponse(result: Success): Homepage {
  const contentType = result.headers['content-type'] ?? null;
  const base: Homepage = {
    ...emptyHomepage(result.finalUrl),
    status: result.status,
    contentType,
    headers: result.headers,
    redirectChain: result.redirectChain,
  };

  if (isChallengePage(result) || BLOCKED_STATUSES.has(result.status)) {
    return { ...base, blocked: true, blockReason: REASON.blocked };
  }
  if (result.status === 404 || result.status === 410) return { ...base, unreachableReason: REASON.notFound };
  if (result.status >= 500) return { ...base, unreachableReason: REASON.serverError };
  if (result.status < 200 || result.status >= 300) return { ...base, unreachableReason: REASON.unexpected };

  const mime = (contentType ?? '').split(';')[0].trim().toLowerCase();
  if (mime !== 'text/html' && mime !== 'application/xhtml+xml') return { ...base, blockReason: REASON.notHtml };
  if (result.body.slice(0, 1024).includes('\u0000')) return { ...base, blockReason: REASON.unreadable };

  return { ...base, rawHtml: result.body };
}

export async function fetchHomepage(url: string, fetcher: Fetcher = safeFetch): Promise<Homepage> {
  const options = { timeoutMs: HOMEPAGE_TIMEOUT_MS, maxBytes: HOMEPAGE_MAX_BYTES };
  let result = await fetcher(url, options);
  // Retry a server error once. A challenge page is not a server error.
  if (result.ok && result.status >= 500 && !isChallengePage(result)) result = await fetcher(url, options);
  return result.ok ? fromResponse(result) : fromFailure(url, result.reason);
}

/** True if http:// redirects to https, false if it stays on http, null if unknown. */
export async function checkHttpRedirect(finalUrl: string, fetcher: Fetcher = safeFetch): Promise<boolean | null> {
  let httpUrl: URL;
  try {
    httpUrl = new URL(finalUrl);
  } catch {
    return null;
  }
  if (httpUrl.protocol !== 'https:') return null;
  httpUrl.protocol = 'http:';

  const result = await fetcher(httpUrl.href, {
    timeoutMs: SMALL_TIMEOUT_MS,
    maxBytes: SMALL_MAX_BYTES,
    maxRedirects: MAX_REDIRECTS,
  });
  if (!result.ok) return null;
  // A 403, 429 or 5xx on http:// does not show whether a redirect exists.
  if (result.status < 200 || result.status >= 400) return null;
  try {
    return new URL(result.finalUrl).protocol === 'https:';
  } catch {
    return null;
  }
}

export async function fetchFavicon(
  origin: string,
  html: string | null,
  fetcher: Fetcher = safeFetch,
): Promise<PageData['favicon']> {
  const linkTag =
    html !== null &&
    loadHtml(html)('link[rel]')
      .toArray()
      .some((el) => (el.attribs.rel ?? '').toLowerCase().split(/\s+/).includes('icon'));

  const icoUrl = new URL('/favicon.ico', origin).href;
  let result = await fetcher(icoUrl, { timeoutMs: SMALL_TIMEOUT_MS, maxBytes: SMALL_MAX_BYTES, method: 'HEAD' });
  // Some servers do not support HEAD. Ask again with GET.
  if (result.ok && (result.status === 405 || result.status === 501)) {
    result = await fetcher(icoUrl, { timeoutMs: SMALL_TIMEOUT_MS, maxBytes: SMALL_MAX_BYTES });
  }
  if (!result.ok) return { linkTag, icoStatus: null };
  // Many single-page apps answer 200 with an HTML page for any path (a soft 404).
  // That page is not an icon, so report it as 404.
  const mime = (result.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  const softNotFound = result.status === 200 && mime === 'text/html';
  return { linkTag, icoStatus: softNotFound ? 404 : result.status };
}

export async function fetchLlmsTxt(origin: string, fetcher: Fetcher = safeFetch): Promise<PageData['llmsTxt']> {
  const result = await fetcher(new URL('/llms.txt', origin).href, {
    timeoutMs: SMALL_TIMEOUT_MS,
    maxBytes: SMALL_MAX_BYTES,
  });
  if (!result.ok) return { present: null };
  if (result.status === 404 || result.status === 410) return { present: false };
  if (result.status !== 200) return { present: null };
  const mime = (result.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  return { present: mime === 'text/plain' || mime === 'text/markdown' };
}

/** Maps a homepage result to a limitation code. Returns null when the homepage was read. */
export function homepageIssue(homepage: PageData['homepage']): Extract<
  LimitationCode,
  'homepage_blocked' | 'homepage_unreachable' | 'non_html' | 'too_large'
> | null {
  if (homepage.blockReason === REASON.tooLarge) return 'too_large';
  if (homepage.blockReason === REASON.notHtml || homepage.blockReason === REASON.unreadable) return 'non_html';
  if (homepage.blocked) return 'homepage_blocked';
  if (homepage.unreachableReason) return 'homepage_unreachable';
  return null;
}

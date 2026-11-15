import * as cheerio from 'cheerio';
import type { PageData } from '@/lib/types';
import { safeFetch } from '@/lib/security/safe-fetch';

type Fetcher = typeof safeFetch;
type Sitemap = PageData['sitemap'];

const SITEMAP_TIMEOUT_MS = 5000;
const SITEMAP_MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROBOTS_SITEMAPS = 3;
const GZIP_TYPES = ['application/gzip', 'application/x-gzip'];

type Probe = { state: 'valid' | 'invalid' | 'error' | 'missing'; isIndex: boolean };

/** The hostname without a leading "www.", so apex and www forms compare as equal. */
const siteHost = (hostname: string) => hostname.toLowerCase().replace(/^www\./, '');

function isSameHost(candidate: string, origin: string): boolean {
  try {
    const url = new URL(candidate);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      siteHost(url.hostname) === siteHost(new URL(origin).hostname)
    );
  } catch {
    return false;
  }
}

async function probe(url: string, fetcher: Fetcher): Promise<Probe> {
  const result = await fetcher(url, { timeoutMs: SITEMAP_TIMEOUT_MS, maxBytes: SITEMAP_MAX_BYTES });
  if (!result.ok) return { state: 'error', isIndex: false };
  if (result.status === 404 || result.status === 410) return { state: 'missing', isIndex: false };
  if (result.status !== 200) return { state: 'error', isIndex: false };

  if (new URL(url).pathname.endsWith('.gz')) {
    // The body is not decompressed here, so a gzip sitemap is not parsed.
    const type = (result.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    // Many servers send a gzip file as application/octet-stream. Without parsing, the file is not proof of a fault.
    return { state: GZIP_TYPES.includes(type) ? 'valid' : 'error', isIndex: false };
  }

  // Google also accepts a text sitemap: one http(s) URL on each line.
  const lines = result.body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 0 && lines.every((line) => /^https?:\/\/\S+$/i.test(line))) {
    return { state: 'valid', isIndex: false };
  }

  const $ = cheerio.load(result.body, { xmlMode: true });
  if ($('urlset').length > 0) return { state: 'valid', isIndex: false };
  if ($('sitemapindex').length > 0) return { state: 'valid', isIndex: true };
  return { state: 'invalid', isIndex: false };
}

export async function fetchSitemap(
  origin: string,
  robotsSitemaps: string[],
  fetcher: Fetcher = safeFetch,
): Promise<Sitemap> {
  const fromRobots = robotsSitemaps.filter((u) => isSameHost(u, origin)).slice(0, MAX_ROBOTS_SITEMAPS);
  const candidates = [...new Set([...fromRobots, new URL('/sitemap.xml', origin).href])];

  let invalid: Sitemap | null = null;
  let errored: Sitemap | null = null;
  for (const url of candidates) {
    const outcome = await probe(url, fetcher);
    if (outcome.state === 'valid') return { state: 'valid', url, isIndex: outcome.isIndex };
    if (outcome.state === 'invalid') invalid ??= { state: 'invalid', url, isIndex: false };
    if (outcome.state === 'error') errored ??= { state: 'error', url, isIndex: false };
  }
  // A candidate that could not be read can still be the real sitemap. Then an invalid one is not proof.
  return errored ?? invalid ?? { state: 'missing', url: null, isIndex: false };
}

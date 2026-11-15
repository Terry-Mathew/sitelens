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

function isSameHost(candidate: string, origin: string): boolean {
  try {
    const url = new URL(candidate);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname === new URL(origin).hostname;
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
    return { state: GZIP_TYPES.includes(type) ? 'valid' : 'invalid', isIndex: false };
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
  return invalid ?? errored ?? { state: 'missing', url: null, isIndex: false };
}

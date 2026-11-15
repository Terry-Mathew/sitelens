import type { PageData, RobotsGroup } from '@/lib/types';
import { safeFetch } from '@/lib/security/safe-fetch';

type Fetcher = typeof safeFetch;
type Robots = PageData['robots'];

const ROBOTS_TIMEOUT_MS = 5000;
const ROBOTS_MAX_BYTES = 500 * 1024;

export function parseRobots(body: string): { groups: RobotsGroup[]; sitemaps: string[] } {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  // True while the last directive was a User-agent line. The next User-agent line joins the same group.
  let collectingAgents = false;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const directive = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (directive === 'sitemap') {
      if (value) sitemaps.push(value);
    } else if (directive === 'user-agent') {
      if (!current || !collectingAgents) {
        current = { userAgents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      if (value) current.userAgents.push(value.toLowerCase());
      collectingAgents = true;
    } else if (directive === 'allow' || directive === 'disallow') {
      collectingAgents = false;
      // An empty value means "no rule". An empty Disallow allows everything.
      if (current && value) current[directive].push(value);
    }
  }
  return { groups, sitemaps };
}

/** Turns a robots path pattern into a regular expression. `*` is a wildcard and `$` is an end anchor. */
function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

function matchLength(pattern: string, path: string): number {
  return patternToRegex(pattern).test(path) ? pattern.replace(/\$$/, '').length : -1;
}

export function isPathAllowed(groups: RobotsGroup[], userAgent: string, path: string): boolean {
  const ua = userAgent.toLowerCase();
  const specific = groups.filter((g) => g.userAgents.some((token) => token !== '*' && ua.includes(token)));
  const matching = specific.length > 0 ? specific : groups.filter((g) => g.userAgents.includes('*'));
  if (matching.length === 0) return true;

  let bestAllow = -1;
  let bestDisallow = -1;
  for (const group of matching) {
    for (const p of group.allow) bestAllow = Math.max(bestAllow, matchLength(p, path));
    for (const p of group.disallow) bestDisallow = Math.max(bestDisallow, matchLength(p, path));
  }
  // The longest match wins. A tie goes to Allow.
  return bestAllow >= bestDisallow;
}

export async function fetchRobots(origin: string, fetcher: Fetcher = safeFetch): Promise<Robots> {
  const result = await fetcher(new URL('/robots.txt', origin).href, {
    timeoutMs: ROBOTS_TIMEOUT_MS,
    maxBytes: ROBOTS_MAX_BYTES,
  });
  if (!result.ok) return { state: 'error', groups: [], sitemaps: [] };
  if (result.status === 404 || result.status === 410) return { state: 'missing', groups: [], sitemaps: [] };
  if (result.status !== 200) return { state: 'error', groups: [], sitemaps: [] };
  // A 200 HTML page is a soft 404 (often a single-page app). It is not a robots file.
  const mime = (result.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if (mime === 'text/html' || /^\s*<(!doctype|html)/i.test(result.body)) {
    return { state: 'missing', groups: [], sitemaps: [] };
  }
  return { state: 'found', ...parseRobots(result.body) };
}

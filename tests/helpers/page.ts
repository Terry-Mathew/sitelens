import type { PageData } from '@/lib/types';

export type DeepPartial<T> = T extends (infer U)[]
  ? U[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export const HEALTHY_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Example Plumbing | Emergency Plumber in Leeds</title>
<meta name="description" content="Example Plumbing offers fast, fair-priced plumbing repairs and boiler servicing across Leeds. Call us or book online today.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://example.com/">
<link rel="icon" href="/favicon.png">
<meta property="og:title" content="Example Plumbing">
<meta property="og:image" content="https://example.com/og.png">
</head>
<body>
<h1>Emergency plumber in Leeds</h1>
<p>We fix leaks, blocked drains and broken boilers.</p>
<img src="/images/van.jpg" alt="Our van">
</body>
</html>`;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function merge(base: unknown, over: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(over)) return over === undefined ? base : over;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(over)) {
    out[key] = merge(base[key], value);
  }
  return out;
}

/** A healthy, reachable page. A test overrides only the fields that it needs. */
export function makePage(overrides: DeepPartial<PageData> = {}): PageData {
  const base: PageData = {
    inputUrl: 'https://example.com/',
    finalUrl: 'https://example.com/',
    scannedAt: '2026-11-15T10:00:00.000Z',
    homepage: {
      status: 200,
      blocked: false,
      contentType: 'text/html; charset=utf-8',
      headers: { 'content-type': 'text/html; charset=utf-8' },
      redirectChain: [],
      rawHtml: HEALTHY_HTML,
    },
    httpRedirectsToHttps: true,
    rendered: { html: HEALTHY_HTML },
    robots: {
      state: 'found',
      groups: [{ userAgents: ['*'], allow: [], disallow: ['/admin'] }],
      sitemaps: ['https://example.com/sitemap.xml'],
    },
    sitemap: { state: 'valid', url: 'https://example.com/sitemap.xml', isIndex: false },
    favicon: { linkTag: true, icoStatus: 200 },
    llmsTxt: { present: false },
    jsRendered: false,
    loadedWith: 'firecrawl',
    limitations: [],
  };
  return merge(base, overrides) as PageData;
}

/** Wraps head and body markup in a minimal document. */
export function htmlPage(head: string, body = '<h1>Hello</h1>', htmlAttrs = 'lang="en"'): string {
  return `<!doctype html><html ${htmlAttrs}><head>${head}</head><body>${body}</body></html>`;
}

/** A page where the homepage could not be read. */
export function blockedPage(reason = 'This site blocked our automated check') {
  return makePage({
    homepage: { status: 403, blocked: true, blockReason: reason, rawHtml: null },
    rendered: null,
    loadedWith: 'direct-fallback',
  });
}

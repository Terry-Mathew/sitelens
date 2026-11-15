import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchSitemap } from '@/lib/gather/sitemap';
import type { SafeFetchResult } from '@/lib/security/safe-fetch';

const fixture = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8');

const ok = (body: string, status = 200, contentType = 'application/xml'): SafeFetchResult => ({
  ok: true,
  status,
  finalUrl: 'https://example.com/x',
  redirectChain: [],
  headers: { 'content-type': contentType },
  body,
  truncated: false,
});

/** Builds a fetcher that answers by exact URL. Unknown URLs answer 404. */
const routes = (map: Record<string, SafeFetchResult>) =>
  vi.fn(async (url: string) => map[url] ?? ok('not found', 404));

describe('fetchSitemap', () => {
  it('accepts a <urlset> at /sitemap.xml as valid', async () => {
    const f = routes({ 'https://example.com/sitemap.xml': ok(fixture('sitemap-urlset.xml')) });
    expect(await fetchSitemap('https://example.com', [], f)).toEqual({
      state: 'valid',
      url: 'https://example.com/sitemap.xml',
      isIndex: false,
    });
  });

  it('accepts a <sitemapindex> as valid with isIndex true', async () => {
    const f = routes({ 'https://example.com/sitemap.xml': ok(fixture('sitemap-index.xml')) });
    expect(await fetchSitemap('https://example.com', [], f)).toEqual({
      state: 'valid',
      url: 'https://example.com/sitemap.xml',
      isIndex: true,
    });
  });

  it('uses the robots.txt Sitemap: URL when /sitemap.xml is 404', async () => {
    const f = routes({ 'https://example.com/map/main.xml': ok(fixture('sitemap-urlset.xml')) });
    const r = await fetchSitemap('https://example.com', ['https://example.com/map/main.xml'], f);
    expect(r).toEqual({ state: 'valid', url: 'https://example.com/map/main.xml', isIndex: false });
  });

  it('tries robots sitemap URLs before /sitemap.xml', async () => {
    const f = routes({
      'https://example.com/map/main.xml': ok(fixture('sitemap-urlset.xml')),
      'https://example.com/sitemap.xml': ok(fixture('sitemap-index.xml')),
    });
    const r = await fetchSitemap('https://example.com', ['https://example.com/map/main.xml'], f);
    expect(r.url).toBe('https://example.com/map/main.xml');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('ignores robots sitemap URLs on another host', async () => {
    const f = routes({});
    const r = await fetchSitemap('https://example.com', ['https://evil.test/sitemap.xml'], f);
    expect(r.state).toBe('missing');
    expect(f).not.toHaveBeenCalledWith('https://evil.test/sitemap.xml', expect.anything());
  });

  it('marks unparseable sitemap as invalid', async () => {
    const f = routes({ 'https://example.com/sitemap.xml': ok('<html><body>Not a sitemap</body></html>') });
    expect(await fetchSitemap('https://example.com', [], f)).toEqual({
      state: 'invalid',
      url: 'https://example.com/sitemap.xml',
      isIndex: false,
    });
  });

  it('returns missing when every candidate is 404', async () => {
    expect(await fetchSitemap('https://example.com', [], routes({}))).toEqual({ state: 'missing', url: null, isIndex: false });
  });

  it('returns error when a request fails and nothing valid is found', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, reason: 'timeout', message: 'x' });
    const r = await fetchSitemap('https://example.com', [], f);
    expect(r.state).toBe('error');
  });

  it('prefers a later valid sitemap over an earlier invalid one', async () => {
    const f = routes({
      'https://example.com/bad.xml': ok('garbage'),
      'https://example.com/sitemap.xml': ok(fixture('sitemap-urlset.xml')),
    });
    const r = await fetchSitemap('https://example.com', ['https://example.com/bad.xml'], f);
    expect(r.state).toBe('valid');
    expect(r.url).toBe('https://example.com/sitemap.xml');
  });

  it('treats a .gz sitemap as valid when the content type is gzip, without parsing', async () => {
    const f = routes({ 'https://example.com/sitemap.xml.gz': ok('\u001f\u008b binary', 200, 'application/gzip') });
    const r = await fetchSitemap('https://example.com', ['https://example.com/sitemap.xml.gz'], f);
    expect(r).toEqual({ state: 'valid', url: 'https://example.com/sitemap.xml.gz', isIndex: false });
  });

  it('marks a .gz sitemap as invalid when the content type is not gzip', async () => {
    const f = routes({ 'https://example.com/sitemap.xml.gz': ok('<html></html>', 200, 'text/html') });
    const r = await fetchSitemap('https://example.com', ['https://example.com/sitemap.xml.gz'], f);
    expect(r.state).toBe('invalid');
  });
});

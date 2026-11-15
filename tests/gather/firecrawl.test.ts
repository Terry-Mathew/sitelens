import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const scrape = vi.fn();
const ctor = vi.fn();
vi.mock('@mendable/firecrawl-js', () => ({
  Firecrawl: class {
    constructor(opts: unknown) {
      ctor(opts);
    }
    scrape = scrape;
  },
}));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scrapeRendered } from '@/lib/gather/firecrawl';

const fixture = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8');

describe('scrapeRendered', () => {
  beforeEach(() => {
    scrape.mockReset();
    ctor.mockReset();
    vi.stubEnv('FIRECRAWL_API_KEY', 'fc-test');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('returns rendered html and asks for html only, full page', async () => {
    scrape.mockResolvedValue({ rawHtml: '<html>ok</html>' });
    expect(await scrapeRendered('https://example.com/')).toEqual({ html: '<html>ok</html>' });
    const [url, options] = scrape.mock.calls[0];
    expect(url).toBe('https://example.com/');
    expect(options.formats).toEqual(['rawHtml']);
    expect(options.onlyMainContent).toBe(false);
    expect(ctor).toHaveBeenCalledWith({ apiKey: 'fc-test' });
  });

  it.each([403, 404, 429, 503])('returns null when Firecrawl reports status %i', async (statusCode) => {
    scrape.mockResolvedValue({ rawHtml: '<html>challenge</html>', metadata: { statusCode } });
    expect(await scrapeRendered('https://example.com/')).toBeNull();
  });

  it('returns html for a 2xx status or a missing status', async () => {
    scrape.mockResolvedValue({ rawHtml: '<html>ok</html>', metadata: { statusCode: 200 } });
    expect(await scrapeRendered('https://example.com/')).toEqual({ html: '<html>ok</html>' });
    scrape.mockResolvedValue({ rawHtml: '<html>ok</html>', metadata: {} });
    expect(await scrapeRendered('https://example.com/')).toEqual({ html: '<html>ok</html>' });
  });

  it('returns null without an API key and does not call the SDK', async () => {
    vi.stubEnv('FIRECRAWL_API_KEY', '');
    expect(await scrapeRendered('https://example.com/')).toBeNull();
    expect(scrape).not.toHaveBeenCalled();
  });

  it('returns null when the SDK throws', async () => {
    scrape.mockRejectedValue(new Error('boom'));
    expect(await scrapeRendered('https://example.com/')).toBeNull();
  });

  it('returns null when html is empty or missing', async () => {
    scrape.mockResolvedValue({ rawHtml: '' });
    expect(await scrapeRendered('https://example.com/')).toBeNull();
    scrape.mockResolvedValue({});
    expect(await scrapeRendered('https://example.com/')).toBeNull();
  });

  it('returns null after 30 seconds', async () => {
    vi.useFakeTimers();
    scrape.mockReturnValue(new Promise(() => {}));
    const pending = scrapeRendered('https://example.com/');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await pending).toBeNull();
  });

  it('does not call the SDK for a non-http(s) URL', async () => {
    expect(await scrapeRendered('file:///etc/passwd')).toBeNull();
    expect(await scrapeRendered('not a url')).toBeNull();
    expect(scrape).not.toHaveBeenCalled();
  });

  it('returns null when a 200 answer is a bot challenge page', async () => {
    scrape.mockResolvedValue({ rawHtml: fixture('cloudflare-challenge.html'), metadata: { statusCode: 200 } });
    expect(await scrapeRendered('https://example.com/')).toBeNull();
  });

  it('keeps a normal page that only loads the Cloudflare script', async () => {
    const html = `<html><body><h1>Plumber</h1><p>${'word '.repeat(300)}</p><script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script></body></html>`;
    scrape.mockResolvedValue({ rawHtml: html, metadata: { statusCode: 200 } });
    expect(await scrapeRendered('https://example.com/')).toEqual({ html });
  });

  it('returns null when the rendered HTML is larger than 5 MB', async () => {
    scrape.mockResolvedValue({ rawHtml: `<html><body>${'x'.repeat(5 * 1024 * 1024)}</body></html>` });
    expect(await scrapeRendered('https://example.com/')).toBeNull();
  });

  it('keeps rendered HTML at exactly 5 MB', async () => {
    const html = 'x'.repeat(5 * 1024 * 1024);
    scrape.mockResolvedValue({ rawHtml: html });
    expect(await scrapeRendered('https://example.com/')).toEqual({ html });
  });

  it('never logs the URL or the key', async () => {
    const spies = (['log', 'warn', 'error', 'info'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    scrape.mockRejectedValue(new Error('failed https://secret.example/ fc-test'));
    await scrapeRendered('https://secret.example/');
    for (const s of spies) expect(s).not.toHaveBeenCalled();
    spies.forEach((s) => s.mockRestore());
  });
});

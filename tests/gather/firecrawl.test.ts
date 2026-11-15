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

import { scrapeRendered } from '@/lib/gather/firecrawl';

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

  it('never logs the URL or the key', async () => {
    const spies = (['log', 'warn', 'error', 'info'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    scrape.mockRejectedValue(new Error('failed https://secret.example/ fc-test'));
    await scrapeRendered('https://secret.example/');
    for (const s of spies) expect(s).not.toHaveBeenCalled();
    spies.forEach((s) => s.mockRestore());
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import full from '@/tests/fixtures/psi-full.json';
import noField from '@/tests/fixtures/psi-no-field.json';
import originOnly from '@/tests/fixtures/psi-origin-only.json';
import errorBody from '@/tests/fixtures/psi-error.json';
import { getPerformanceProvider, normalisePageSpeed, pageSpeedProvider } from '@/lib/performance';

const UNAVAILABLE_TIMEOUT = 'Google PageSpeed did not respond in time.';
const UNAVAILABLE_FAILED = 'Google PageSpeed could not test this page.';
const UNAVAILABLE_SHAPE = 'Performance data was unavailable at the time of the review.';

describe('normalisePageSpeed', () => {
  it('normalises scores x100 rounded and lab metrics from audits', () => {
    const r = normalisePageSpeed(full);
    expect(r).not.toBeNull();
    expect(r!.strategy).toBe('mobile');
    expect(r!.fetchedAt).toBe('2026-11-15T10:00:00.000Z');
    expect(r!.lab.scores).toEqual({ performance: 72, accessibility: 87, bestPractices: 96, seo: 100 });
    expect(r!.lab.metrics).toEqual({
      lcpMs: 3142.5,
      cls: 0.0312,
      tbtMs: 187,
      fcpMs: 1620.3,
      speedIndexMs: 3410,
    });
  });

  it('reads url-scope field data with ratings and CLS divided by 100', () => {
    const r = normalisePageSpeed(full)!;
    expect(r.field).toEqual({
      scope: 'url',
      lcp: { p75: 2400, rating: 'needs-improvement' },
      inp: { p75: 180, rating: 'good' },
      cls: { p75: 0.05, rating: 'good' },
    });
  });

  it('returns field null when neither loadingExperience has metrics', () => {
    expect(normalisePageSpeed(noField)!.field).toBeNull();
  });

  it('uses origin scope when only originLoadingExperience has metrics', () => {
    const r = normalisePageSpeed(originOnly)!;
    expect(r.field).toEqual({
      scope: 'origin',
      lcp: { p75: 4500, rating: 'poor' },
      inp: { p75: 250, rating: 'needs-improvement' },
      cls: { p75: 0.12, rating: 'needs-improvement' },
    });
  });

  it.each([
    ['null', null],
    ['string', 'x'],
    ['empty object', {}],
    ['error body', errorBody],
    ['categories as array', { lighthouseResult: { categories: [], audits: {} } }],
  ])('returns null for unknown shape: %s', (_n, input) => {
    expect(() => normalisePageSpeed(input)).not.toThrow();
    expect(normalisePageSpeed(input)).toBeNull();
  });

  it('returns null when one required lab field is missing or not a number', () => {
    const missingAudit = structuredClone(full) as typeof full;
    delete (missingAudit.lighthouseResult.audits as Record<string, unknown>)['speed-index'];
    expect(normalisePageSpeed(missingAudit)).toBeNull();

    const badScore = structuredClone(full) as typeof full;
    (badScore.lighthouseResult.categories.seo as { score: unknown }).score = null;
    expect(normalisePageSpeed(badScore)).toBeNull();

    const badMetric = structuredClone(full) as typeof full;
    (badMetric.lighthouseResult.audits['total-blocking-time'] as { numericValue: unknown }).numericValue = '187';
    expect(normalisePageSpeed(badMetric)).toBeNull();
  });

  it('ignores a field metric with an unknown rating', () => {
    const input = structuredClone(full) as typeof full;
    (input.loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS as { category: unknown }).category = 'NONE';
    const field = normalisePageSpeed(input)!.field;
    expect(field?.lcp).toBeUndefined();
    expect(field?.inp).toBeDefined();
  });
});

describe('pageSpeedProvider', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('PAGESPEED_API_KEY', 'test-key');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('is the provider that getPerformanceProvider returns', () => {
    expect(getPerformanceProvider()).toBe(pageSpeedProvider);
    expect(pageSpeedProvider.id).toBe('pagespeed');
  });

  it('calls Google with the mobile strategy, four categories, and the key', async () => {
    fetchMock.mockResolvedValue(json(full));
    const outcome = await pageSpeedProvider.fetch('https://example.com/');
    expect(outcome.ok).toBe(true);
    const [requested, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const url = new URL(requested);
    expect(url.origin + url.pathname).toBe('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    expect(url.searchParams.get('url')).toBe('https://example.com/');
    expect(url.searchParams.get('strategy')).toBe('mobile');
    expect(url.searchParams.getAll('category')).toEqual(['performance', 'accessibility', 'best-practices', 'seo']);
    expect(url.searchParams.get('key')).toBe('test-key');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('omits the key parameter when PAGESPEED_API_KEY is not set', async () => {
    vi.stubEnv('PAGESPEED_API_KEY', '');
    fetchMock.mockResolvedValue(json(full));
    await pageSpeedProvider.fetch('https://example.com/');
    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.has('key')).toBe(false);
  });

  it('returns unavailable on a Google error body', async () => {
    fetchMock.mockResolvedValue(json(errorBody, 500));
    expect(await pageSpeedProvider.fetch('https://example.com/')).toEqual({
      ok: false,
      unavailable: UNAVAILABLE_FAILED,
    });
  });

  it('returns unavailable when a 200 response holds an error body', async () => {
    fetchMock.mockResolvedValue(json(errorBody, 200));
    expect(await pageSpeedProvider.fetch('https://example.com/')).toEqual({
      ok: false,
      unavailable: UNAVAILABLE_FAILED,
    });
  });

  it('returns unavailable on a timeout', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));
    expect(await pageSpeedProvider.fetch('https://example.com/')).toEqual({
      ok: false,
      unavailable: UNAVAILABLE_TIMEOUT,
    });
  });

  it('returns unavailable on a network failure, with no raw error text', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED 1.2.3.4:443 https://example.com'));
    expect(await pageSpeedProvider.fetch('https://example.com/')).toEqual({
      ok: false,
      unavailable: UNAVAILABLE_FAILED,
    });
  });

  it('returns the shape message when the body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>oops</html>', { status: 200 }));
    expect(await pageSpeedProvider.fetch('https://example.com/')).toEqual({
      ok: false,
      unavailable: UNAVAILABLE_SHAPE,
    });
  });

  it('returns the shape message when required lab fields are missing', async () => {
    fetchMock.mockResolvedValue(json({ lighthouseResult: {} }));
    expect(await pageSpeedProvider.fetch('https://example.com/')).toEqual({
      ok: false,
      unavailable: UNAVAILABLE_SHAPE,
    });
  });

  it('never logs the scanned URL or the key', async () => {
    const spies = [vi.spyOn(console, 'error'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'log')].map((s) =>
      s.mockImplementation(() => {}),
    );
    fetchMock.mockRejectedValue(new Error('boom https://example.com test-key'));
    await pageSpeedProvider.fetch('https://example.com/');
    for (const s of spies) {
      expect(JSON.stringify(s.mock.calls)).not.toMatch(/example\.com|test-key/);
    }
  });
});

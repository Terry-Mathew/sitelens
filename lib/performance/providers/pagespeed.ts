import type {
  CwvRating,
  FieldMetric,
  PageSpeedOutcome,
  PageSpeedResult,
  PerformanceProvider,
} from '@/lib/performance/types';

const ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const TIMEOUT_MS = 60_000;
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

const UNAVAILABLE_TIMEOUT = 'Google PageSpeed did not respond in time.';
const UNAVAILABLE_FAILED = 'Google PageSpeed could not test this page.';
const UNAVAILABLE_SHAPE = 'Performance data was unavailable at the time of the review.';

const RATINGS: Record<string, CwvRating> = {
  FAST: 'good',
  AVERAGE: 'needs-improvement',
  SLOW: 'poor',
};

type Obj = Record<string, unknown>;

function asObject(value: unknown): Obj | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Obj) : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readScore(categories: Obj | null, key: string): number | null {
  const score = asNumber(asObject(categories?.[key])?.score);
  return score === null ? null : Math.round(score * 100);
}

function readAudit(audits: Obj | null, key: string): number | null {
  return asNumber(asObject(audits?.[key])?.numericValue);
}

function readFieldMetric(metrics: Obj | null, key: string, divisor = 1): FieldMetric | undefined {
  const metric = asObject(metrics?.[key]);
  const percentile = asNumber(metric?.percentile);
  const category = metric?.category;
  const rating = typeof category === 'string' ? RATINGS[category] : undefined;
  if (percentile === null || !rating) return undefined;
  return { p75: percentile / divisor, rating };
}

const FIELD_KEYS = ['LARGEST_CONTENTFUL_PAINT_MS', 'INTERACTION_TO_NEXT_PAINT', 'CUMULATIVE_LAYOUT_SHIFT_SCORE'];

function readField(experience: unknown, scope: 'url' | 'origin'): PageSpeedResult['field'] {
  const metrics = asObject(asObject(experience)?.metrics);
  if (!metrics || !FIELD_KEYS.some((key) => key in metrics)) return null;
  const field: NonNullable<PageSpeedResult['field']> = { scope };
  const lcp = readFieldMetric(metrics, 'LARGEST_CONTENTFUL_PAINT_MS');
  const inp = readFieldMetric(metrics, 'INTERACTION_TO_NEXT_PAINT');
  // CrUX gives the CLS percentile multiplied by 100.
  const cls = readFieldMetric(metrics, 'CUMULATIVE_LAYOUT_SHIFT_SCORE', 100);
  // A metric with an unknown rating or a bad percentile is dropped. No usable metric means no field data.
  if (!lcp && !inp && !cls) return null;
  if (lcp) field.lcp = lcp;
  if (inp) field.inp = inp;
  if (cls) field.cls = cls;
  return field;
}

/**
 * Turns a PageSpeed v5 response into SiteLens values.
 * Returns null when a required lab field is missing. It never throws and never guesses.
 */
export function normalisePageSpeed(json: unknown): PageSpeedResult | null {
  const lighthouse = asObject(asObject(json)?.lighthouseResult);
  if (!lighthouse) return null;
  const categories = asObject(lighthouse.categories);
  const audits = asObject(lighthouse.audits);

  const performance = readScore(categories, 'performance');
  const accessibility = readScore(categories, 'accessibility');
  const bestPractices = readScore(categories, 'best-practices');
  const seo = readScore(categories, 'seo');
  const lcpMs = readAudit(audits, 'largest-contentful-paint');
  const cls = readAudit(audits, 'cumulative-layout-shift');
  const tbtMs = readAudit(audits, 'total-blocking-time');
  const fcpMs = readAudit(audits, 'first-contentful-paint');
  const speedIndexMs = readAudit(audits, 'speed-index');
  if (
    performance === null || accessibility === null || bestPractices === null || seo === null ||
    lcpMs === null || cls === null || tbtMs === null || fcpMs === null || speedIndexMs === null
  ) {
    return null;
  }

  const root = asObject(json);
  const fetchTime = lighthouse.fetchTime;
  return {
    fetchedAt: typeof fetchTime === 'string' ? fetchTime : new Date().toISOString(),
    strategy: 'mobile',
    lab: {
      scores: { performance, accessibility, bestPractices, seo },
      metrics: { lcpMs, cls, tbtMs, fcpMs, speedIndexMs },
    },
    field: readField(root?.loadingExperience, 'url') ?? readField(root?.originLoadingExperience, 'origin'),
  };
}

function buildRequestUrl(url: string): string {
  const params = new URLSearchParams({ url, strategy: 'mobile' });
  for (const category of CATEGORIES) params.append('category', category);
  // The key is optional. PageSpeed works without it at a low quota.
  const key = process.env.PAGESPEED_API_KEY;
  if (key) params.set('key', key);
  return `${ENDPOINT}?${params.toString()}`;
}

export const pageSpeedProvider: PerformanceProvider = {
  id: 'pagespeed',
  async fetch(url: string): Promise<PageSpeedOutcome> {
    // This request goes to Google, not to the user site. Never log the URL or the key.
    let response: Response;
    try {
      response = await fetch(buildRequestUrl(url), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      return { ok: false, unavailable: timedOut ? UNAVAILABLE_TIMEOUT : UNAVAILABLE_FAILED };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { ok: false, unavailable: response.ok ? UNAVAILABLE_SHAPE : UNAVAILABLE_FAILED };
    }
    if (!response.ok || asObject(body)?.error !== undefined) {
      return { ok: false, unavailable: UNAVAILABLE_FAILED };
    }

    const data = normalisePageSpeed(body);
    return data ? { ok: true, data } : { ok: false, unavailable: UNAVAILABLE_SHAPE };
  },
};

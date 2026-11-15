export type CwvRating = 'good' | 'needs-improvement' | 'poor';
export interface FieldMetric {
  p75: number;
  rating: CwvRating;
}
export interface PageSpeedResult {
  fetchedAt: string;
  strategy: 'mobile';
  lab: {
    // Google Lighthouse category scores. Integers from 0 to 100.
    scores: { performance: number; accessibility: number; bestPractices: number; seo: number };
    metrics: { lcpMs: number; cls: number; tbtMs: number; fcpMs: number; speedIndexMs: number };
  };
  // null means Google has not got enough real-user data.
  field: { scope: 'url' | 'origin'; lcp?: FieldMetric; inp?: FieldMetric; cls?: FieldMetric } | null;
}
export type PageSpeedOutcome = { ok: true; data: PageSpeedResult } | { ok: false; unavailable: string };

// App code must use this interface. Only lib/performance may know which provider runs.
export interface PerformanceProvider {
  id: string;
  fetch(url: string): Promise<PageSpeedOutcome>;
}

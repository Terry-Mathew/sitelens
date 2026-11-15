import type { PageSpeedResult } from '@/lib/performance';
import type { Finding, ScanResult } from '@/lib/types';

export const failedTitle: Finding = {
  checkId: 'title',
  category: 'technical-seo',
  status: 'fail',
  severity: 'opportunity',
  confidence: 'verified',
  evidence: { text: 'Home', length: 4, missing: ['og:title', 'og:image'], redirectsToHttps: false },
  source: 'rendered',
};

export const unableFinding: Finding = {
  checkId: 'sitemap',
  category: 'technical-seo',
  status: 'unable_to_check',
  severity: 'info',
  confidence: 'verified',
  evidence: {},
  source: 'sitemap',
  unableReason: 'The sitemap could not be read',
};

export const scan: ScanResult = {
  id: 'scan-1',
  url: 'https://example.com/',
  finalUrl: 'https://example.com/',
  scannedAt: '2026-11-15T10:00:00.000Z',
  findings: [failedTitle, unableFinding],
  jsRendered: false,
  loadedWith: 'firecrawl',
  limitations: [],
};

export const pagespeedData: PageSpeedResult = {
  fetchedAt: '2026-11-15T10:01:00.000Z',
  strategy: 'mobile',
  lab: {
    scores: { performance: 42, accessibility: 91, bestPractices: 78, seo: 100 },
    metrics: { lcpMs: 4230, cls: 0.123, tbtMs: 610, fcpMs: 1880, speedIndexMs: 5120 },
  },
  field: null,
};

export const pagespeedOk = { ok: true as const, data: pagespeedData };

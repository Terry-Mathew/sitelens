import type { Finding, ScanResult } from '@/lib/types';
import type { PageSpeedOutcome } from '@/lib/performance';

export function finding(checkId: string, status: Finding['status'], severity: Finding['severity']): Finding {
  return {
    checkId,
    category: 'technical-seo',
    status,
    severity,
    confidence: 'verified',
    evidence: { value: checkId },
    source: 'rendered',
    ...(status === 'unable_to_check' ? { unableReason: 'Test reason.' } : {}),
  };
}

export function scanWith(findings: Finding[], over: Partial<ScanResult> = {}): ScanResult {
  return {
    id: 'scan-1',
    url: 'https://example.com',
    finalUrl: 'https://www.example.com/',
    scannedAt: '2026-11-15T10:00:00.000Z',
    findings,
    jsRendered: false,
    loadedWith: 'firecrawl',
    limitations: [],
    ...over,
  };
}

export const psOk = (field: boolean, score = 30): PageSpeedOutcome => ({
  ok: true,
  data: {
    fetchedAt: '2026-11-15T10:00:00.000Z',
    strategy: 'mobile',
    lab: {
      scores: { performance: score, accessibility: 90, bestPractices: 90, seo: 90 },
      metrics: { lcpMs: 1, cls: 0, tbtMs: 1, fcpMs: 1, speedIndexMs: 1 },
    },
    field: field ? { scope: 'url', lcp: { p75: 2000, rating: 'good' } } : null,
  },
});
export const psFail: PageSpeedOutcome = { ok: false, unavailable: 'down' };

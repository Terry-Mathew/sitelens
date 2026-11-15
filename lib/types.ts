export type Severity = 'critical' | 'warning' | 'opportunity' | 'info' | 'passed';
export type Category =
  | 'technical-seo'
  | 'content'
  | 'conversion'
  | 'ai-readiness'
  | 'performance';
export type CheckStatus = 'pass' | 'fail' | 'observation' | 'not_applicable' | 'unable_to_check';
export type Confidence = 'verified' | 'heuristic';
export type LimitationCode =
  | 'firecrawl_unavailable'
  | 'homepage_blocked'
  | 'homepage_unreachable'
  | 'non_html'
  | 'too_large'
  | 'js_fallback'
  | 'robots_unavailable'
  | 'sitemap_unavailable'
  | 'performance_unavailable'
  | 'field_data_unavailable';
export type EvidenceSource = 'rendered' | 'raw' | 'headers' | 'robots' | 'sitemap' | 'pagespeed';

export interface Finding {
  checkId: string;
  category: Category;
  status: CheckStatus;
  severity: Severity;
  confidence: Confidence;
  evidence: Record<string, unknown>;
  source: EvidenceSource;
  unableReason?: string;
}
// Severity for status 'observation' is 'info'; for 'pass' is 'passed'; for unable/not_applicable is 'info'.
export type CheckOutcome = Omit<Finding, 'checkId' | 'category' | 'confidence'>;

export interface RobotsGroup {
  userAgents: string[];
  allow: string[];
  disallow: string[];
}

export interface PageData {
  inputUrl: string;
  finalUrl: string;
  scannedAt: string;
  homepage: {
    status: number | null;
    blocked: boolean;
    blockReason?: string;
    unreachableReason?: string;
    contentType: string | null;
    headers: Record<string, string>;
    redirectChain: string[];
    rawHtml: string | null;
  };
  httpRedirectsToHttps: boolean | null; // null = could not determine
  rendered: { html: string } | null; // Firecrawl output; null = fallback
  robots: { state: 'found' | 'missing' | 'error'; groups: RobotsGroup[]; sitemaps: string[] };
  sitemap: { state: 'valid' | 'invalid' | 'missing' | 'error'; url: string | null; isIndex: boolean };
  favicon: { linkTag: boolean; icoStatus: number | null };
  llmsTxt: { present: boolean | null };
  jsRendered: boolean;
  loadedWith: 'firecrawl' | 'direct-fallback';
  limitations: LimitationCode[];
}

export interface Check {
  id: string;
  category: Category;
  confidence: Confidence;
  run(page: PageData): CheckOutcome;
}

export interface ScanResult {
  id: string;
  url: string;
  finalUrl: string;
  scannedAt: string;
  findings: Finding[];
  jsRendered: boolean;
  loadedWith: PageData['loadedWith'];
  limitations: LimitationCode[];
}

export interface ScanResponse {
  scan: ScanResult;
  performanceTicket: string;
}

export interface CheckCopy {
  title: string;
  clientTitle: string;
  whyItMatters: string;
  howToFix: string;
}

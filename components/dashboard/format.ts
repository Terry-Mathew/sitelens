import type { CwvRating } from '@/lib/performance';
import type { Category, EvidenceSource, Finding } from '@/lib/types';

// Display helpers for the technical view. They change only the format of a value, never the value.

export const CATEGORY_ORDER: Category[] = ['technical-seo', 'content', 'conversion', 'ai-readiness', 'performance'];

export const CATEGORY_LABEL: Record<Category, string> = {
  'technical-seo': 'Technical & SEO',
  content: 'Content',
  conversion: 'Conversion',
  'ai-readiness': 'AI search readiness',
  performance: 'Performance',
};

export const SOURCE_LABEL: Record<EvidenceSource, string> = {
  rendered: 'Page loaded in a browser',
  raw: 'Raw page HTML',
  headers: 'HTTP response headers',
  robots: 'robots.txt file',
  sitemap: 'Sitemap',
  pagespeed: 'Google PageSpeed Insights',
};

export type Tone = 'critical' | 'warning' | 'opportunity' | 'passed' | 'observation' | 'unable' | 'neutral';

export const TONE_CLASS: Record<Tone, string> = {
  critical: 'border-sev-critical-border bg-sev-critical-bg text-sev-critical',
  warning: 'border-sev-warning-border bg-sev-warning-bg text-sev-warning',
  opportunity: 'border-sev-opportunity-border bg-sev-opportunity-bg text-sev-opportunity',
  passed: 'border-sev-passed-border bg-sev-passed-bg text-sev-passed',
  observation: 'border-sev-observation-border bg-sev-observation-bg text-sev-observation',
  unable: 'border-dashed border-sev-unable-border bg-sev-unable-bg text-sev-unable',
  neutral: 'border-border bg-muted text-muted-foreground',
};

/** The tone and the badge text for a finding. */
export function findingTone(f: Finding): { tone: Tone; label: string } {
  switch (f.status) {
    case 'pass':
      return { tone: 'passed', label: 'Passed' };
    case 'observation':
      return { tone: 'observation', label: 'Observation' };
    case 'unable_to_check':
      return { tone: 'unable', label: 'Could not check' };
    case 'not_applicable':
      return { tone: 'neutral', label: 'Not applicable' };
    case 'fail':
      if (f.severity === 'critical') return { tone: 'critical', label: 'Critical' };
      if (f.severity === 'warning') return { tone: 'warning', label: 'Warning' };
      if (f.severity === 'opportunity') return { tone: 'opportunity', label: 'Opportunity' };
      return { tone: 'observation', label: 'Info' };
  }
}

const ACRONYMS: Record<string, string> = { url: 'URL', h1: 'H1', og: 'OG', http: 'HTTP', https: 'HTTPS', lcp: 'LCP', inp: 'INP', cls: 'CLS' };

/** Turns an evidence key such as "finalUrl" into "Final URL". */
export function evidenceLabel(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => ACRONYMS[w] ?? w);
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Formats an evidence value as read-only text. Arrays become comma lists. Booleans become Yes or No. */
export function formatEvidenceValue(value: unknown): string {
  if (value === null || value === undefined) return 'Not available';
  if (value === '') return 'Empty';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.length === 0 ? 'None' : value.map(formatEvidenceValue).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${formatEvidenceValue(v)}`)
      .join(', ');
  }
  return String(value);
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

export function formatMs(ms: number): string {
  return `${Math.round(ms)} ms`;
}

export function formatCls(value: number): string {
  return value.toFixed(2);
}

export const RATING_LABEL: Record<CwvRating, string> = {
  good: 'Good',
  'needs-improvement': 'Needs improvement',
  poor: 'Poor',
};

export const RATING_TONE: Record<CwvRating, Tone> = {
  good: 'passed',
  'needs-improvement': 'warning',
  poor: 'critical',
};

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

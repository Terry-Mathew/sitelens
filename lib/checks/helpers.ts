import type { CheerioAPI } from 'cheerio';
import { loadHtml } from '@/lib/html';
import type { CheckOutcome, EvidenceSource, PageData } from '@/lib/types';

const DEFAULT_UNABLE_REASON = 'Homepage could not be read';

/** The reason to show when the homepage HTML is not available. */
export function homepageUnableReason(page: PageData): string {
  return page.homepage.blockReason ?? page.homepage.unreachableReason ?? DEFAULT_UNABLE_REASON;
}

export function unable(reason: string, source: EvidenceSource = 'raw'): CheckOutcome {
  return { status: 'unable_to_check', severity: 'info', evidence: {}, source, unableReason: reason };
}

export function pass(evidence: Record<string, unknown>, source: EvidenceSource): CheckOutcome {
  return { status: 'pass', severity: 'passed', evidence, source };
}

export type HtmlView = { $: CheerioAPI; source: 'rendered' | 'raw' };

/** Rendered HTML if present, else raw HTML. Returns null when the homepage HTML is not available. */
export function readHtml(page: PageData): HtmlView | null {
  if (page.rendered?.html) return { $: loadHtml(page.rendered.html), source: 'rendered' };
  if (page.homepage.rawHtml !== null) return { $: loadHtml(page.homepage.rawHtml), source: 'raw' };
  return null;
}

/** Runs an HTML-based check. Returns unable_to_check when the homepage HTML is not available. */
export function withHtml(
  page: PageData,
  run: (view: HtmlView) => CheckOutcome,
): CheckOutcome {
  const view = readHtml(page);
  return view ? run(view) : unable(homepageUnableReason(page));
}

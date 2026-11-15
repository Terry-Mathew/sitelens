import { CHECK_COPY } from '@/lib/content/checks';
import type { PageSpeedOutcome } from '@/lib/performance';
import type { ScanResult } from '@/lib/types';
import { reportSections, type ReportDraft } from '@/lib/report/draft';
import { formatDate, type Region } from '@/lib/report/region';

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

// Join items with commas and a final "and". Two items have no comma.
function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

// The text describes only what the report selects. It never says the site has no issues
// when the user excluded a failed finding.
export function buildSummary(
  scan: ScanResult,
  pagespeed: PageSpeedOutcome | undefined,
  draft: ReportDraft,
  region: Region,
): string {
  const host = new URL(scan.finalUrl).hostname.replace(/^www\./, '');
  const sentences = [`We reviewed the homepage of ${host} on ${formatDate(scan.scannedAt, region)}.`];

  const sections = reportSections(scan, pagespeed, draft);
  const issues = sections.findings;
  if (issues.length > 0) {
    const count = (severity: string) => issues.filter((f) => f.severity === severity).length;
    const [c, w, o] = [count('critical'), count('warning'), count('opportunity')];
    const parts = [
      c > 0 ? `${c} critical` : '',
      w > 0 ? `${w} ${plural(w, 'warning', 'warnings')}` : '',
      o > 0 ? `${o} ${plural(o, 'opportunity', 'opportunities')}` : '',
    ].filter(Boolean);
    sentences.push(
      `This report highlights ${issues.length} ${plural(issues.length, 'issue', 'issues')} selected for review: ${list(parts)}.`,
    );
    const top = issues.slice(0, 3).map((f) => CHECK_COPY[f.checkId]?.clientTitle ?? f.checkId);
    sentences.push(`The most important ${plural(top.length, 'is', 'are')}: ${list(top)}.`);
  } else if (sections.selectionNote) {
    sentences.push('This report focuses on the areas you selected.');
  } else {
    sentences.push('We did not find significant issues in the areas we checked.');
  }

  const k = sections.couldNotCheck.length;
  if (k > 0) sentences.push(`${k} ${plural(k, 'item', 'items')} could not be checked automatically.`);
  return sentences.join(' ');
}

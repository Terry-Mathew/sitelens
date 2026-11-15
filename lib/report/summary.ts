import { CHECK_COPY } from '@/lib/content/checks';
import type { PageSpeedOutcome } from '@/lib/performance';
import type { LimitationCode, ScanResult } from '@/lib/types';
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

// A client title is a sentence. In the middle of a sentence its first letter is lower case,
// unless the title starts with an acronym such as "HTTPS".
function midSentence(title: string): string {
  if (/^[A-Z]{2}/.test(title)) return title;
  return title.charAt(0).toLowerCase() + title.slice(1);
}

// These limitations stop most checks of the homepage.
const BLOCKING: LimitationCode[] = ['homepage_blocked', 'homepage_unreachable', 'non_html', 'too_large', 'js_fallback'];

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
    const top = issues.slice(0, 3).map((f) => midSentence(CHECK_COPY[f.checkId]?.clientTitle ?? f.checkId));
    sentences.push(`The most important ${plural(top.length, 'is', 'are')}: ${list(top)}.`);
  } else if (sections.selectionNote) {
    sentences.push('This report focuses on the areas you selected.');
  } else if (sections.limitations.some((code) => BLOCKING.includes(code))) {
    sentences.push('We could not review most of the homepage automatically. The limitations section explains why.');
  } else if (sections.couldNotCheck.length > 0) {
    sentences.push('We did not find significant issues in the areas we could check.');
  } else {
    sentences.push('We did not find significant issues in the areas we checked.');
  }

  const k = sections.couldNotCheck.length;
  if (k > 0) sentences.push(`${k} ${plural(k, 'item', 'items')} could not be checked automatically.`);
  return sentences.join(' ');
}

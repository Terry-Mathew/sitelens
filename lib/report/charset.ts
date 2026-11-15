import { CHECK_COPY } from '@/lib/content/checks';
import type { PageSpeedOutcome } from '@/lib/performance';
import { reportSections, type ReportDraft } from '@/lib/report/draft';
import type { Branding } from '@/lib/storage';
import type { ScanResult } from '@/lib/types';

// The PDF uses the built-in Helvetica font. It can show only Windows-1252 (WinAnsi) characters.
// The characters in 0x80 to 0x9F of Windows-1252 that are not Latin-1.
const WINDOWS_1252_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

/** True when the PDF font can show every character of the text. */
export function isPrintable(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code <= 0x7f || (code >= 0xa0 && code <= 0xff)) continue;
    if (!WINDOWS_1252_EXTRA.has(char)) return false;
  }
  return true;
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

export interface PrintedReport {
  scan: ScanResult;
  pagespeed: PageSpeedOutcome | undefined;
  draft: ReportDraft;
  branding: Branding;
}

/** True when a string that the PDF prints has a character that the PDF font cannot show. */
export function hasUnprintableText({ scan, pagespeed, draft, branding }: PrintedReport): boolean {
  const sections = reportSections(scan, pagespeed, draft);
  const withEvidence = [...sections.findings, ...sections.observations];
  const shown = [...withEvidence, ...sections.passed, ...sections.couldNotCheck];
  const printed = [
    branding.name,
    branding.contact,
    draft.clientBusinessName,
    draft.nextSteps,
    ...withEvidence.flatMap((f) => strings(f.evidence)),
    ...sections.couldNotCheck.map((f) => f.unableReason),
    ...shown.flatMap((f) => {
      const copy = CHECK_COPY[f.checkId];
      return copy ? [copy.title, copy.clientTitle, copy.whyItMatters, copy.howToFix] : [f.checkId];
    }),
  ];
  return printed.some((text) => typeof text === 'string' && !isPrintable(text));
}

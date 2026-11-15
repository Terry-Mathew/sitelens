import type { Check } from '@/lib/types';
import { pass, withTextHtml } from '@/lib/checks/helpers';
import { visibleText } from '@/lib/html';

const FIRST_YEAR = 1990;
const WINDOW = 30;
const MARKER = /©|copyright/gi;
const YEAR = /\b(?:19|20)\d{2}\b/g;

/** Latest year in the text near a copyright marker. Returns null when there is none. */
function latestCopyrightYear(text: string, scanYear: number): number | null {
  let latest: number | null = null;
  for (const marker of text.matchAll(MARKER)) {
    const start = Math.max(0, marker.index - WINDOW);
    const end = marker.index + marker[0].length + WINDOW;
    for (const found of text.slice(start, end).matchAll(YEAR)) {
      const year = Number(found[0]);
      if (year < FIRST_YEAR || year > scanYear) continue;
      if (latest === null || year > latest) latest = year;
    }
  }
  return latest;
}

export const check: Check = {
  id: 'copyright-year',
  category: 'content',
  confidence: 'heuristic',
  run: (page) =>
    withTextHtml(page, ({ $, source }) => {
      // The scan date comes from the page data, not from the clock.
      const scanYear = new Date(page.scannedAt).getUTCFullYear();
      const year = latestCopyrightYear(visibleText($), scanYear);
      if (year === null) return { status: 'not_applicable', severity: 'info', evidence: {}, source };
      const evidence = { year, scanYear };
      // A year one year before the scan year is normal. An older year can look neglected.
      if (year >= scanYear - 1) return pass(evidence, source);
      return { status: 'fail', severity: 'opportunity', evidence, source };
    }),
};

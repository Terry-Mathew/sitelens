import type { Check } from '@/lib/types';
import { homepageUnableReason, pass, unable } from '@/lib/checks/helpers';
import { loadHtml, visibleText, wordCount } from '@/lib/html';

const RATIO_LIMIT = 0.3;
const RAW_WORD_LIMIT = 150;

const words = (html: string) => wordCount(visibleText(loadHtml(html)));

export const check: Check = {
  id: 'no-js-content',
  category: 'ai-readiness',
  confidence: 'heuristic',
  run(page) {
    const raw = page.homepage.rawHtml;
    if (raw === null) return unable(homepageUnableReason(page));
    const rawWords = words(raw);

    // Fallback mode: no rendered copy exists. The scan only knows if the page needs JavaScript.
    if (!page.rendered) {
      const evidence = { rawWords };
      if (!page.jsRendered) return pass(evidence, 'raw');
      return { status: 'fail', severity: 'warning', evidence, source: 'raw' };
    }

    const renderedWords = words(page.rendered.html);
    const evidence = { rawWords, renderedWords };
    const missing = rawWords < renderedWords * RATIO_LIMIT && rawWords < RAW_WORD_LIMIT;
    if (!missing) return pass(evidence, 'rendered');
    return { status: 'fail', severity: 'warning', evidence, source: 'rendered' };
  },
};

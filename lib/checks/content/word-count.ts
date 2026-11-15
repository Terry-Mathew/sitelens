import type { Check } from '@/lib/types';
import { pass, withTextHtml } from '@/lib/checks/helpers';
import { visibleText, wordCount } from '@/lib/html';

// A page with fewer words than this can look thin to visitors and search engines.
const MIN_WORDS = 250;

export const check: Check = {
  id: 'word-count',
  category: 'content',
  confidence: 'heuristic',
  run: (page) =>
    withTextHtml(page, ({ $, source }) => {
      const words = wordCount(visibleText($));
      const evidence = { words, minimum: MIN_WORDS };
      if (words >= MIN_WORDS) return pass(evidence, source);
      return { status: 'fail', severity: 'warning', evidence, source };
    }),
};

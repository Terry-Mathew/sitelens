import type { Check } from '@/lib/types';
import { pass, withHtml } from '@/lib/checks/helpers';

export const check: Check = {
  id: 'heading-order',
  category: 'content',
  confidence: 'heuristic',
  run: (page) =>
    withHtml(page, ({ $, source }) => {
      const levels = $('h1, h2, h3, h4, h5, h6')
        .toArray()
        .map((el) => Number(el.tagName.slice(1)));
      if (levels.length === 0) return { status: 'not_applicable', severity: 'info', evidence: {}, source };
      // A heading can go back to any higher level. It must not skip a level going down.
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] > levels[i - 1] + 1) {
          const evidence = { skip: `h${levels[i - 1]}→h${levels[i]}`, headingCount: levels.length };
          return { status: 'fail', severity: 'opportunity', evidence, source };
        }
      }
      return pass({ headingCount: levels.length }, source);
    }),
};

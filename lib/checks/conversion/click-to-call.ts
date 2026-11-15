import type { Check } from '@/lib/types';
import { pass, withTextHtml } from '@/lib/checks/helpers';

export const check: Check = {
  id: 'click-to-call',
  category: 'conversion',
  confidence: 'heuristic',
  run: (page) =>
    withTextHtml(page, ({ $, source }) => {
      const count = $('a[href^="tel:" i]').length;
      const evidence = { tel: count > 0, count };
      if (count > 0) return pass(evidence, source);
      return { status: 'fail', severity: 'opportunity', evidence, source };
    }),
};

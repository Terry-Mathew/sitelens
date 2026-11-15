import type { Check } from '@/lib/types';
import { pass, withHtml } from '@/lib/checks/helpers';

export const check: Check = {
  id: 'single-h1',
  category: 'technical-seo',
  confidence: 'verified',
  run: (page) =>
    withHtml(page, ({ $, source }) => {
      const texts = $('h1')
        .toArray()
        .map((el) => $(el).text().replace(/\s+/g, ' ').trim());
      const evidence = { count: texts.length, texts };
      if (texts.length === 1) return pass(evidence, source);
      return { status: 'fail', severity: 'warning', evidence, source };
    }),
};

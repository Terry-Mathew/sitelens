import type { Check } from '@/lib/types';
import { pass, withHtml } from '@/lib/checks/helpers';

// Spec 7.3: 30 to 60 characters.
const MIN = 30;
const MAX = 60;

export const check: Check = {
  id: 'title',
  category: 'technical-seo',
  confidence: 'verified',
  run: (page) =>
    withHtml(page, ({ $, source }) => {
      const text = $('title').first().text().trim();
      if (text === '') {
        return { status: 'fail', severity: 'warning', evidence: { text: null, length: 0 }, source };
      }
      const evidence = { text, length: text.length };
      if (text.length >= MIN && text.length <= MAX) return pass(evidence, source);
      return { status: 'fail', severity: 'opportunity', evidence, source };
    }),
};

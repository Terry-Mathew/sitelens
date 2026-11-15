import type { Check } from '@/lib/types';
import { pass, withHtml } from '@/lib/checks/helpers';

// Spec 7.3: 70 to 160 characters.
const MIN = 70;
const MAX = 160;

export const check: Check = {
  id: 'meta-description',
  category: 'technical-seo',
  confidence: 'verified',
  run: (page) =>
    withHtml(page, ({ $, source }) => {
      const text = ($('meta[name="description" i]').first().attr('content') ?? '').trim();
      if (text === '') {
        return { status: 'fail', severity: 'warning', evidence: { text: null, length: 0 }, source };
      }
      const evidence = { text, length: text.length };
      if (text.length >= MIN && text.length <= MAX) return pass(evidence, source);
      return { status: 'fail', severity: 'opportunity', evidence, source };
    }),
};

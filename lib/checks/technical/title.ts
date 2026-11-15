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
      // Use the document title. An inline SVG can also hold a title element.
      const headTitle = $('head > title').first();
      const text = (headTitle.length > 0 ? headTitle : $('title').not('svg title').first()).text().trim();
      if (text === '') {
        return { status: 'fail', severity: 'warning', evidence: { text: null, length: 0 }, source };
      }
      const evidence = { text, length: text.length };
      if (text.length >= MIN && text.length <= MAX) return pass(evidence, source);
      return { status: 'fail', severity: 'opportunity', evidence, source };
    }),
};

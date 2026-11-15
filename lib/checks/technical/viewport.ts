import type { Check } from '@/lib/types';
import { pass, withHtml } from '@/lib/checks/helpers';

export const check: Check = {
  id: 'viewport',
  category: 'technical-seo',
  confidence: 'verified',
  run: (page) =>
    withHtml(page, ({ $, source }) => {
      const tag = $('meta[name="viewport" i]').first();
      if (tag.length === 0) return { status: 'fail', severity: 'warning', evidence: { content: null }, source };
      return pass({ content: (tag.attr('content') ?? '').trim() }, source);
    }),
};

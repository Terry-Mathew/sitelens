import type { Check } from '@/lib/types';
import { pass, withHtml } from '@/lib/checks/helpers';

export const check: Check = {
  id: 'html-lang',
  category: 'technical-seo',
  confidence: 'verified',
  run: (page) =>
    withHtml(page, ({ $, source }) => {
      const lang = ($('html').first().attr('lang') ?? '').trim();
      if (lang === '') return { status: 'fail', severity: 'opportunity', evidence: { lang: null }, source };
      return pass({ lang }, source);
    }),
};

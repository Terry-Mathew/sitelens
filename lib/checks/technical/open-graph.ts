import type { Check } from '@/lib/types';
import { pass, withHtml } from '@/lib/checks/helpers';

export const check: Check = {
  id: 'open-graph',
  category: 'technical-seo',
  confidence: 'verified',
  run: (page) =>
    withHtml(page, ({ $, source }) => {
      const read = (property: string): string | null => {
        const tag = $(`meta[property="${property}" i], meta[name="${property}" i]`).first();
        const value = (tag.attr('content') ?? '').trim();
        return value === '' ? null : value;
      };
      const title = read('og:title');
      const image = read('og:image');
      const missing = [title === null ? 'og:title' : null, image === null ? 'og:image' : null].filter(
        (m): m is string => m !== null,
      );
      const evidence = { title, image, missing };
      if (missing.length === 0) return pass(evidence, source);
      return { status: 'fail', severity: 'opportunity', evidence, source };
    }),
};

import type { Check } from '@/lib/types';
import { pass, withHtml } from '@/lib/checks/helpers';

const MAX_EXAMPLES = 10;

function fileName(src: string | undefined): string {
  const value = (src ?? '').trim();
  if (value === '') return '(no src)';
  if (value.toLowerCase().startsWith('data:')) return '(inline image)';
  const path = value.split(/[?#]/)[0];
  const last = path.split('/').filter(Boolean).pop();
  return last ?? value;
}

export const check: Check = {
  id: 'img-alt',
  category: 'technical-seo',
  confidence: 'verified',
  run: (page) =>
    withHtml(page, ({ $, source }) => {
      const images = $('img').toArray();
      if (images.length === 0) return { status: 'not_applicable', severity: 'info', evidence: {}, source };
      // An empty alt="" is valid. It marks a decorative image. Only a missing attribute counts.
      const missing = images.filter((el) => el.attribs.alt === undefined);
      const evidence = {
        missingCount: missing.length,
        totalCount: images.length,
        examples: missing.slice(0, MAX_EXAMPLES).map((el) => fileName(el.attribs.src)),
      };
      if (missing.length === 0) return pass(evidence, source);
      return { status: 'fail', severity: 'warning', evidence, source };
    }),
};

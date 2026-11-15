import type { Check } from '@/lib/types';
import { pass, unable } from '@/lib/checks/helpers';

export const check: Check = {
  id: 'sitemap',
  category: 'technical-seo',
  confidence: 'verified',
  run(page) {
    const { state, url } = page.sitemap;
    if (state === 'error') return unable('The sitemap could not be checked', 'sitemap');
    const evidence = { state, url };
    if (state === 'valid') return pass(evidence, 'sitemap');
    return { status: 'fail', severity: 'warning', evidence, source: 'sitemap' };
  },
};

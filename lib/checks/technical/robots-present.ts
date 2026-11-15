import type { Check } from '@/lib/types';
import { unable } from '@/lib/checks/helpers';

export const check: Check = {
  id: 'robots-present',
  category: 'technical-seo',
  confidence: 'verified',
  run(page) {
    const { state } = page.robots;
    if (state === 'error') return unable('The robots.txt file could not be read', 'robots');
    // A missing robots.txt is a neutral fact, not a failure.
    return { status: 'observation', severity: 'info', evidence: { present: state === 'found' }, source: 'robots' };
  },
};

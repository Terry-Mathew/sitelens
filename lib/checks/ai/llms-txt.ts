import type { Check } from '@/lib/types';
import { unable } from '@/lib/checks/helpers';

export const check: Check = {
  id: 'llms-txt',
  category: 'ai-readiness',
  confidence: 'verified',
  run(page) {
    const { present } = page.llmsTxt;
    if (present === null) return unable('The /llms.txt file could not be checked');
    return { status: 'observation', severity: 'info', evidence: { present }, source: 'raw' };
  },
};

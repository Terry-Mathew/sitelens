import type { Check } from '@/lib/types';
import { homepageUnableReason, pass, unable } from '@/lib/checks/helpers';

// The chain lists each URL that answered with a redirect. Its length is the number of redirects.
const MAX_REDIRECTS = 2;

export const check: Check = {
  id: 'redirect-chain',
  category: 'technical-seo',
  confidence: 'verified',
  run(page) {
    if (page.homepage.status === null) return unable(homepageUnableReason(page), 'headers');
    const chain = [...page.homepage.redirectChain];
    const evidence = { hops: chain.length, chain };
    if (chain.length <= MAX_REDIRECTS) return pass(evidence, 'headers');
    return { status: 'fail', severity: 'opportunity', evidence, source: 'headers' };
  },
};

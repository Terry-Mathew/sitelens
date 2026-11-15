import type { Check } from '@/lib/types';
import { REASON } from '@/lib/gather/direct';
import { homepageUnableReason, pass, unable } from '@/lib/checks/helpers';

// A clear outage: no answer from the network, 404 or 410, or a 5xx after a retry.
// A block, a timeout, a too-large page or an unusual status is not proof that the site is down.
function isOutage(status: number | null): boolean {
  return status === null || status === 404 || status === 410 || status >= 500;
}

export const check: Check = {
  id: 'site-reachable',
  category: 'technical-seo',
  confidence: 'verified',
  run(page) {
    const { status, unreachableReason } = page.homepage;
    if (unreachableReason && unreachableReason !== REASON.notAllowed && isOutage(status)) {
      return {
        status: 'fail',
        severity: 'critical',
        evidence: { status, finalUrl: page.finalUrl },
        source: 'headers',
      };
    }
    if (page.homepage.blocked || page.homepage.blockReason || unreachableReason) {
      return unable(homepageUnableReason(page), 'headers');
    }
    return pass({ status, finalUrl: page.finalUrl }, 'headers');
  },
};

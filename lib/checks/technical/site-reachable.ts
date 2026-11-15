import type { Check } from '@/lib/types';
import { REASON } from '@/lib/gather/direct';
import { homepageUnableReason, pass, unable } from '@/lib/checks/helpers';

// A clear outage has a known cause: no answer from the network, 404 or 410, or a 5xx after a retry.
// Compare the stable reason text from gathering. Any other failure is not proof that the site is down.
function isOutage(status: number | null, reason: string | undefined): boolean {
  if (reason === REASON.unreachable) return status === null;
  if (reason === REASON.notFound) return status === 404 || status === 410;
  if (reason === REASON.serverError) return status !== null && status >= 500;
  return false;
}

export const check: Check = {
  id: 'site-reachable',
  category: 'technical-seo',
  confidence: 'verified',
  run(page) {
    const { status, unreachableReason } = page.homepage;
    if (isOutage(status, unreachableReason)) {
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

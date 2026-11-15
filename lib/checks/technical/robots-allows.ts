import type { Check, RobotsGroup } from '@/lib/types';
import { isPathAllowed } from '@/lib/gather/robots';
import { pass, unable } from '@/lib/checks/helpers';

/** The Disallow rule in the `*` groups that blocks the root path. The longest rule wins. */
function blockingRule(groups: RobotsGroup[]): string | null {
  let best: string | null = null;
  for (const group of groups) {
    if (!group.userAgents.includes('*')) continue;
    for (const rule of group.disallow) {
      const blocks = !isPathAllowed([{ userAgents: ['*'], allow: [], disallow: [rule] }], '*', '/');
      if (blocks && (best === null || rule.length > best.length)) best = rule;
    }
  }
  return best;
}

export const check: Check = {
  id: 'robots-allows',
  category: 'technical-seo',
  confidence: 'verified',
  run(page) {
    const { state, groups } = page.robots;
    if (state === 'missing') {
      return { status: 'not_applicable', severity: 'info', evidence: {}, source: 'robots' };
    }
    if (state === 'error') return unable('The robots.txt file could not be read', 'robots');

    const blocksAll = !isPathAllowed(groups, '*', '/');
    // "Blocks all crawlers" is true only if every crawler that has its own group is blocked too.
    const namedAgents = new Set(groups.flatMap((g) => g.userAgents).filter((ua) => ua !== '*'));
    const someNamedAllowed = [...namedAgents].some((ua) => isPathAllowed(groups, ua, '/'));

    const rule = blockingRule(groups);
    if (blocksAll && !someNamedAllowed && rule !== null) {
      return {
        status: 'fail',
        severity: 'critical',
        evidence: { userAgent: '*', disallow: rule, line: `Disallow: ${rule}` },
        source: 'robots',
      };
    }
    return pass({ userAgent: '*', rootAllowed: !blocksAll }, 'robots');
  },
};

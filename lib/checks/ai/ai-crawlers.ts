import type { Check } from '@/lib/types';
import { unable } from '@/lib/checks/helpers';
import { isPathAllowed } from '@/lib/gather/robots';

export const AI_CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot',
] as const;

export const check: Check = {
  id: 'ai-crawlers',
  category: 'ai-readiness',
  confidence: 'verified',
  run(page) {
    const { state, groups } = page.robots;
    if (state === 'error') return unable('The robots.txt file could not be read', 'robots');
    const crawlers: Record<string, 'allowed' | 'blocked'> = {};
    for (const name of AI_CRAWLERS) {
      crawlers[name] = isPathAllowed(groups, name, '/') ? 'allowed' : 'blocked';
    }
    // A site can choose to block AI crawlers. This is a fact, not a failure.
    const evidence: Record<string, unknown> = { crawlers };
    if (state === 'missing') evidence.note = 'No robots.txt file';
    return { status: 'observation', severity: 'info', evidence, source: 'robots' };
  },
};

import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/ai/ai-crawlers';
import { makePage } from '../../helpers/page';

const CRAWLERS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot'];

describe('ai-crawlers', () => {
  it('GPTBot blocked, others allowed → observation', () => {
    const page = makePage({
      robots: { groups: [{ userAgents: ['gptbot'], allow: [], disallow: ['/'] }] },
    });
    const r = check.run(page);
    expect(r).toMatchObject({ status: 'observation', severity: 'info', source: 'robots' });
    const crawlers = r.evidence.crawlers as Record<string, string>;
    expect(crawlers.GPTBot).toBe('blocked');
    for (const name of CRAWLERS.filter((n) => n !== 'GPTBot')) expect(crawlers[name]).toBe('allowed');
  });

  it('lists all seven crawlers', () => {
    const r = check.run(makePage());
    expect(Object.keys(r.evidence.crawlers as object)).toEqual(CRAWLERS);
  });

  it('missing robots.txt → all allowed with a note', () => {
    const r = check.run(makePage({ robots: { state: 'missing', groups: [], sitemaps: [] } }));
    expect(r.status).toBe('observation');
    expect(r.evidence.note).toBe('No robots.txt file');
    expect(Object.values(r.evidence.crawlers as Record<string, string>).every((v) => v === 'allowed')).toBe(true);
  });

  it('robots error → unable_to_check', () => {
    const r = check.run(makePage({ robots: { state: 'error', groups: [], sitemaps: [] } }));
    expect(r.status).toBe('unable_to_check');
    expect(r.unableReason).toBeTruthy();
  });

  it('never returns fail or pass', () => {
    const r = check.run(makePage({ robots: { groups: [{ userAgents: ['*'], allow: [], disallow: ['/'] }] } }));
    expect(['fail', 'pass']).not.toContain(r.status);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchRobots, isPathAllowed, parseRobots } from '@/lib/gather/robots';
import type { SafeFetchResult } from '@/lib/security/safe-fetch';

const robotsFixture = readFileSync(join(__dirname, '..', 'fixtures', 'robots.txt'), 'utf8');

const ok = (body: string, status = 200): SafeFetchResult => ({
  ok: true,
  status,
  finalUrl: 'https://example.com/robots.txt',
  redirectChain: [],
  headers: { 'content-type': 'text/plain' },
  body,
  truncated: false,
});

describe('parseRobots', () => {
  it('parses robots groups, allow/disallow, and Sitemap lines', () => {
    const { groups, sitemaps } = parseRobots(robotsFixture);
    expect(groups).toEqual([
      { userAgents: ['*'], allow: ['/admin/public/'], disallow: ['/admin/', '/private'] },
      { userAgents: ['gptbot', 'ccbot'], allow: [], disallow: ['/'] },
    ]);
    expect(sitemaps).toEqual(['https://example.com/sitemap.xml', 'https://example.com/news-sitemap.xml']);
  });

  it('handles CRLF line endings and mixed case directives', () => {
    const { groups } = parseRobots('USER-AGENT: *\r\nDISALLOW: /x\r\n');
    expect(groups).toEqual([{ userAgents: ['*'], allow: [], disallow: ['/x'] }]);
  });

  it('ignores rules that appear before any User-agent line', () => {
    expect(parseRobots('Disallow: /x\n').groups).toEqual([]);
  });
});

describe('isPathAllowed', () => {
  it('Disallow: / for * blocks everything', () => {
    const { groups } = parseRobots('User-agent: *\nDisallow: /');
    expect(isPathAllowed(groups, 'GPTBot', '/')).toBe(false);
    expect(isPathAllowed(groups, 'Googlebot', '/anything')).toBe(false);
  });

  it('specific GPTBot group overrides *', () => {
    const { groups } = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /');
    expect(isPathAllowed(groups, 'GPTBot', '/page')).toBe(true);
    expect(isPathAllowed(groups, 'OtherBot', '/page')).toBe(false);
  });

  it('matches the user agent as a case-insensitive token inside a longer string', () => {
    const { groups } = parseRobots('User-agent: GPTBot\nDisallow: /');
    expect(isPathAllowed(groups, 'Mozilla/5.0 (compatible; GPTBot/1.2)', '/')).toBe(false);
  });

  it('longest match wins, and Allow wins a tie', () => {
    const { groups } = parseRobots('User-agent: *\nDisallow: /admin/\nAllow: /admin/public/\nDisallow: /tie\nAllow: /tie');
    expect(isPathAllowed(groups, 'x', '/admin/secret')).toBe(false);
    expect(isPathAllowed(groups, 'x', '/admin/public/file')).toBe(true);
    expect(isPathAllowed(groups, 'x', '/tie')).toBe(true);
  });

  it('supports * and $ wildcards', () => {
    const { groups } = parseRobots('User-agent: *\nDisallow: /*.pdf$\nDisallow: /tmp*/x');
    expect(isPathAllowed(groups, 'x', '/a/b.pdf')).toBe(false);
    expect(isPathAllowed(groups, 'x', '/a/b.pdf?x=1')).toBe(true);
    expect(isPathAllowed(groups, 'x', '/tmp123/x')).toBe(false);
  });

  it('allows everything when no group matches', () => {
    expect(isPathAllowed([], 'x', '/')).toBe(true);
    const { groups } = parseRobots('User-agent: Other\nDisallow: /');
    expect(isPathAllowed(groups, 'x', '/')).toBe(true);
  });

  it('an empty Disallow allows everything', () => {
    const { groups } = parseRobots('User-agent: *\nDisallow:');
    expect(isPathAllowed(groups, 'x', '/a')).toBe(true);
  });
});

describe('fetchRobots', () => {
  it('returns found with groups and sitemaps for 200', async () => {
    const f = vi.fn().mockResolvedValue(ok(robotsFixture));
    const r = await fetchRobots('https://example.com', f);
    expect(r.state).toBe('found');
    expect(r.groups).toHaveLength(2);
    expect(r.sitemaps).toHaveLength(2);
    expect(f).toHaveBeenCalledWith('https://example.com/robots.txt', { timeoutMs: 5000, maxBytes: 500 * 1024 });
  });

  it('returns missing for 404', async () => {
    const r = await fetchRobots('https://example.com', vi.fn().mockResolvedValue(ok('nope', 404)));
    expect(r).toEqual({ state: 'missing', groups: [], sitemaps: [] });
  });

  it('returns error for a server error', async () => {
    const r = await fetchRobots('https://example.com', vi.fn().mockResolvedValue(ok('x', 503)));
    expect(r).toEqual({ state: 'error', groups: [], sitemaps: [] });
  });

  it('returns error when the request fails', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, reason: 'timeout', message: 'x' });
    expect(await fetchRobots('https://example.com', f)).toEqual({ state: 'error', groups: [], sitemaps: [] });
  });
});

import { describe, it, expect, vi } from 'vitest';

// Counts every HTML parse. Milestone review I5: one scan must parse each HTML string once.
const loads = vi.hoisted(() => ({ count: 0 }));
vi.mock('cheerio', async (importOriginal) => {
  const actual = await importOriginal<typeof import('cheerio')>();
  return {
    ...actual,
    load: (...args: Parameters<typeof actual.load>) => {
      loads.count += 1;
      return actual.load(...args);
    },
  };
});

import { runChecks } from '@/lib/checks/run';
import { loadHtml } from '@/lib/html';
import { makePage, HEALTHY_HTML } from '../helpers/page';

describe('HTML parsing in one scan', () => {
  it('returns the same document for the same HTML string', () => {
    const html = `${HEALTHY_HTML}<!-- same -->`;
    expect(loadHtml(html)).toBe(loadHtml(html));
  });

  it('parses the rendered and raw HTML a small fixed number of times for all checks', () => {
    // Distinct strings, so the test does not depend on an earlier cache entry.
    const rendered = `${HEALTHY_HTML}<!-- rendered ${Math.random()} -->`;
    const raw = `${HEALTHY_HTML}<!-- raw ${Math.random()} -->`;
    const page = makePage({ rendered: { html: rendered }, homepage: { rawHtml: raw } });
    loads.count = 0;
    runChecks(page);
    // One parse for each document, and one visible-text copy for each document.
    expect(loads.count).toBeLessThanOrEqual(4);
  });
});

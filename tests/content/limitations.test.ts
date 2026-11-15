import { describe, it, expect } from 'vitest';
import { LIMITATION_TEXT } from '@/lib/content/limitations';
import type { LimitationCode } from '@/lib/types';

const ALL: LimitationCode[] = [
  'firecrawl_unavailable',
  'homepage_blocked',
  'homepage_unreachable',
  'non_html',
  'too_large',
  'js_fallback',
  'robots_unavailable',
  'sitemap_unavailable',
  'performance_unavailable',
  'field_data_unavailable',
];

describe('LIMITATION_TEXT', () => {
  it('has text for every LimitationCode', () => {
    ALL.forEach((code) => {
      expect(LIMITATION_TEXT[code], code).toBeTruthy();
      expect(LIMITATION_TEXT[code].endsWith('.')).toBe(true);
    });
    expect(Object.keys(LIMITATION_TEXT).sort()).toEqual([...ALL].sort());
  });
});

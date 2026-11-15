import { describe, it, expect } from 'vitest';
import { checks } from '@/lib/checks/registry';
import { CHECK_COPY } from '@/lib/content/checks';

describe('check copy', () => {
  it('every registered check has copy', () => {
    checks.forEach((c) => {
      const copy = CHECK_COPY[c.id];
      expect(copy, c.id).toBeDefined();
      expect(copy.title).toBeTruthy();
      expect(copy.clientTitle).toBeTruthy();
      expect(copy.whyItMatters).toBeTruthy();
      expect(copy.howToFix).toBeTruthy();
    });
  });
});

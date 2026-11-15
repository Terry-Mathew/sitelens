import { describe, it, expect } from 'vitest';
import { checks } from '@/lib/checks/registry';
import { CHECK_COPY } from '@/lib/content/checks';

describe('check copy', () => {
  it('every registered check and performance finding has copy', () => {
    const ids = [...checks.map((c) => c.id), 'lab-performance', 'field-cwv'];
    ids.forEach((id) => {
      const copy = CHECK_COPY[id];
      expect(copy, id).toBeDefined();
      expect(copy.title).toBeTruthy();
      expect(copy.clientTitle).toBeTruthy();
      expect(copy.whyItMatters).toBeTruthy();
      expect(copy.howToFix).toBeTruthy();
    });
  });
});

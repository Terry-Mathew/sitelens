import type { Check } from '@/lib/types';
import { pass, withHtml } from '@/lib/checks/helpers';
import { parseJsonLd, shortType, typesOf } from '@/lib/checks/ai/jsonld';
import { ORGANIZATION_TYPES } from '@/lib/checks/ai/organization-types';

const MAX_EVIDENCE_TYPES = 20;

function isBusinessType(type: string): boolean {
  const name = shortType(type);
  return ORGANIZATION_TYPES.has(name) || name.endsWith('Business');
}

export const check: Check = {
  id: 'structured-data',
  category: 'ai-readiness',
  confidence: 'verified',
  run: (page) =>
    withHtml(page, ({ $, source }) => {
      const { nodes, invalidBlocks } = parseJsonLd($);
      const types = typesOf(nodes);
      // Test all types. Cap only the list that is shown as evidence.
      const evidence = { types: types.slice(0, MAX_EVIDENCE_TYPES), invalidBlocks };
      if (types.some(isBusinessType)) return pass(evidence, source);
      return { status: 'fail', severity: 'opportunity', evidence, source };
    }),
};

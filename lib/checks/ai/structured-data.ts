import type { Check } from '@/lib/types';
import { pass, withHtml } from '@/lib/checks/helpers';
import { parseJsonLd, typesOf } from '@/lib/checks/ai/jsonld';

const BUSINESS_TYPES = new Set([
  'Organization', 'LocalBusiness', 'Restaurant', 'Store', 'ProfessionalService',
  'MedicalOrganization', 'LegalService', 'HomeAndConstructionBusiness',
]);

const isBusinessType = (type: string) => BUSINESS_TYPES.has(type) || type.endsWith('Business');

export const check: Check = {
  id: 'structured-data',
  category: 'ai-readiness',
  confidence: 'verified',
  run: (page) =>
    withHtml(page, ({ $, source }) => {
      const { nodes, invalidBlocks } = parseJsonLd($);
      const types = typesOf(nodes);
      const evidence = { types, invalidBlocks };
      if (types.some(isBusinessType)) return pass(evidence, source);
      return { status: 'fail', severity: 'opportunity', evidence, source };
    }),
};

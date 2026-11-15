import type { Check } from '@/lib/types';
import { pass, withTextHtml } from '@/lib/checks/helpers';
import { hasAddress, hasTelephone, parseJsonLd } from '@/lib/checks/ai/jsonld';

export const check: Check = {
  id: 'machine-readable-contact',
  category: 'ai-readiness',
  confidence: 'heuristic',
  run: (page) =>
    withTextHtml(page, ({ $, source }) => {
      const { nodes } = parseJsonLd($);
      const phoneFound = $('a[href^="tel:" i]').length > 0 || hasTelephone(nodes);
      const addressElement = $('address').toArray().some((el) => $(el).text().trim() !== '');
      const addressFound = addressElement || hasAddress(nodes);
      const evidence = { phoneFound, addressFound };
      if (phoneFound && addressFound) return pass(evidence, source);
      return { status: 'fail', severity: 'opportunity', evidence, source };
    }),
};

import type { Check } from '@/lib/types';
import { pass, withTextHtml } from '@/lib/checks/helpers';

export const check: Check = {
  id: 'contact-method',
  category: 'conversion',
  confidence: 'heuristic',
  run: (page) =>
    withTextHtml(page, ({ $, source }) => {
      const evidence = {
        tel: $('a[href^="tel:" i]').length > 0,
        mailto: $('a[href^="mailto:" i]').length > 0,
        form: $('form').length > 0,
      };
      if (evidence.tel || evidence.mailto || evidence.form) return pass(evidence, source);
      // Heuristic: a contact method can exist in a way that this check cannot see. It is never Critical.
      return { status: 'fail', severity: 'warning', evidence, source };
    }),
};

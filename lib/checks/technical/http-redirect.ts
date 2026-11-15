import type { Check } from '@/lib/types';
import { pass, unable } from '@/lib/checks/helpers';

export const check: Check = {
  id: 'http-redirect',
  category: 'technical-seo',
  confidence: 'verified',
  run(page) {
    const redirectsToHttps = page.httpRedirectsToHttps;
    if (redirectsToHttps === null) {
      return unable('We could not tell whether the http:// address redirects to https://', 'headers');
    }
    if (redirectsToHttps) return pass({ redirectsToHttps }, 'headers');
    return { status: 'fail', severity: 'warning', evidence: { redirectsToHttps }, source: 'headers' };
  },
};

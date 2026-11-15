import type { Check } from '@/lib/types';
import { homepageUnableReason, pass, unable } from '@/lib/checks/helpers';

export const check: Check = {
  id: 'https',
  category: 'technical-seo',
  confidence: 'verified',
  run(page) {
    // No response means the final URL is only the typed address, so it proves nothing.
    if (page.homepage.status === null) return unable(homepageUnableReason(page), 'headers');
    let protocol: string;
    try {
      protocol = new URL(page.finalUrl).protocol;
    } catch {
      return unable('The final address could not be read', 'headers');
    }
    // Our https:// request failed, but the browser render of the https:// address worked.
    // The browser can repair some certificate problems, so a fail here could be false.
    if (page.homepage.httpFallback && page.rendered !== null) {
      return unable('The secure address loaded in a browser but not for our check', 'headers');
    }
    const evidence = { finalUrl: page.finalUrl, protocol };
    if (protocol === 'https:') return pass(evidence, 'headers');
    return { status: 'fail', severity: 'critical', evidence, source: 'headers' };
  },
};

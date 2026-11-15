import type { Check } from '@/lib/types';
import { homepageUnableReason, pass, readHtml, unable } from '@/lib/checks/helpers';

export const check: Check = {
  id: 'favicon',
  category: 'technical-seo',
  confidence: 'verified',
  run(page) {
    const view = readHtml(page);
    const { icoStatus } = page.favicon;
    if (!view && icoStatus === null) return unable(homepageUnableReason(page));

    const renderedLink =
      view?.$('link[rel]')
        .toArray()
        .some((el) => (el.attribs.rel ?? '').toLowerCase().split(/\s+/).includes('icon')) ?? false;
    const linkTag = page.favicon.linkTag || renderedLink;
    const evidence = { linkTag, icoStatus };
    const source = view?.source ?? 'raw';

    if (linkTag || icoStatus === 200) return pass(evidence, source);
    // A fail needs both facts: the page has no icon link, and /favicon.ico is not there.
    if (view && (icoStatus === 404 || icoStatus === 410)) {
      return { status: 'fail', severity: 'opportunity', evidence, source };
    }
    return unable('We could not confirm whether the site has a favicon', source);
  },
};

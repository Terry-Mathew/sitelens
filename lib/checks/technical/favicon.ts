import type { Check } from '@/lib/types';
import { loadHtml } from '@/lib/html';
import { JS_CONTENT_REASON, homepageUnableReason, isJsShellFallback, pass, readHtml, unable } from '@/lib/checks/helpers';

/** True for a usable icon address. An empty href or an empty data: URL (for example "data:,") is a deliberate empty icon. */
function isUsableHref(href: string): boolean {
  const value = href.trim();
  if (value === '') return false;
  if (!/^data:/i.test(value)) return true;
  const comma = value.indexOf(',');
  return comma >= 0 && value.slice(comma + 1).trim() !== '';
}

function hasIconLink(html: string | null | undefined): boolean {
  if (!html) return false;
  return loadHtml(html)('link[rel]')
    .toArray()
    .some(
      (el) =>
        (el.attribs.rel ?? '').toLowerCase().split(/\s+/).includes('icon') && isUsableHref(el.attribs.href ?? ''),
    );
}

export const check: Check = {
  id: 'favicon',
  category: 'technical-seo',
  confidence: 'verified',
  run(page) {
    const view = readHtml(page);
    const { icoStatus } = page.favicon;
    if (!view && icoStatus === null) return unable(homepageUnableReason(page));

    const linkTag = hasIconLink(page.rendered?.html) || hasIconLink(page.homepage.rawHtml);
    const evidence = { linkTag, icoStatus };
    const source = view?.source ?? 'raw';

    if (linkTag || icoStatus === 200) return pass(evidence, source);
    // The raw HTML of a JavaScript app does not show the icon link that a browser can add.
    if (view && isJsShellFallback(page)) return unable(JS_CONTENT_REASON, source);
    // A fail needs both facts: the page has no icon link, and /favicon.ico is not there.
    if (view && (icoStatus === 404 || icoStatus === 410)) {
      return { status: 'fail', severity: 'opportunity', evidence, source };
    }
    return unable('We could not confirm whether the site has a favicon', source);
  },
};

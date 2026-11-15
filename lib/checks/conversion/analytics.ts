import type { Check } from '@/lib/types';
import { homepageUnableReason, pass, readHtml, unable } from '@/lib/checks/helpers';
import { loadHtml } from '@/lib/html';

// Each tool has patterns for a script address or for inline script text. Patterns use lower case.
const TOOLS: { name: string; patterns: string[] }[] = [
  { name: 'Google Analytics', patterns: ['googletagmanager.com/gtag/js', 'google-analytics.com'] },
  { name: 'Google Tag Manager', patterns: ['googletagmanager.com/gtm.js'] },
  { name: 'Meta Pixel', patterns: ['connect.facebook.net', 'fbq('] },
  { name: 'Plausible', patterns: ['plausible.io'] },
  { name: 'Fathom', patterns: ['usefathom.com'] },
  { name: 'Matomo', patterns: ['matomo'] },
];

/** Script addresses and inline script text, in lower case. */
function scriptText(html: string): string {
  const $ = loadHtml(html);
  return $('script')
    .toArray()
    .map((el) => `${el.attribs.src ?? ''}\n${$(el).text()}`)
    .join('\n')
    .toLowerCase();
}

export const check: Check = {
  id: 'analytics',
  category: 'conversion',
  confidence: 'heuristic',
  run: (page) => {
    const view = readHtml(page);
    if (!view) return unable(homepageUnableReason(page));
    // Read both versions. A tag manager can add a tool only in the rendered page.
    const sources = [page.rendered?.html, page.homepage.rawHtml].filter(
      (html): html is string => typeof html === 'string' && html !== '',
    );
    const haystack = sources.map(scriptText).join('\n');
    const tools = TOOLS.filter((t) => t.patterns.some((p) => haystack.includes(p))).map((t) => t.name);
    const evidence = { tools };
    if (tools.length > 0) return pass(evidence, view.source);
    return { status: 'fail', severity: 'opportunity', evidence, source: view.source };
  },
};

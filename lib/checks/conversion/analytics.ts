import type { Check } from '@/lib/types';
import { pass, withHtml } from '@/lib/checks/helpers';
import { loadHtml } from '@/lib/html';

// Each tool has patterns for a script address or for inline script text. Patterns use lower case.
const TOOLS: { name: string; patterns: string[] }[] = [
  { name: 'Google Analytics', patterns: ['googletagmanager.com/gtag/js', 'google-analytics.com'] },
  { name: 'Google Tag Manager', patterns: ['googletagmanager.com/gtm.js'] },
  { name: 'Meta Pixel', patterns: ['connect.facebook.net', 'fbq('] },
  { name: 'Plausible', patterns: ['plausible.io'] },
  { name: 'Fathom', patterns: ['usefathom.com'] },
  { name: 'Matomo', patterns: ['matomo'] },
  { name: 'Microsoft Clarity', patterns: ['clarity.ms'] },
  { name: 'Hotjar', patterns: ['static.hotjar.com'] },
  { name: 'HubSpot', patterns: ['js.hs-scripts.com', 'js.hs-analytics.net'] },
  { name: 'Cloudflare Web Analytics', patterns: ['static.cloudflareinsights.com'] },
  { name: 'Segment', patterns: ['cdn.segment.com'] },
];

// Website builders that include visitor statistics for the site owner. These are not tools that the page loads,
// so they are never listed in evidence.tools. Generator patterns match the generator meta tag. Host patterns
// match a script or stylesheet address. Patterns use lower case.
const PLATFORMS: { name: string; generator: string; hosts: string[] }[] = [
  { name: 'Wix', generator: 'wix.com', hosts: ['static.parastorage.com', 'static.wixstatic.com'] },
  { name: 'Squarespace', generator: 'squarespace', hosts: ['static1.squarespace.com', 'assets.squarespace.com'] },
  { name: 'Shopify', generator: 'shopify', hosts: ['cdn.shopify.com'] },
];

function detectPlatform(sources: string[]): string | null {
  const generators: string[] = [];
  const addresses: string[] = [];
  for (const html of sources) {
    const $ = loadHtml(html);
    $('meta[name="generator" i]').each((_, el) => void generators.push((el.attribs.content ?? '').toLowerCase()));
    $('script[src], link[href]').each(
      (_, el) => void addresses.push((el.attribs.src ?? el.attribs.href ?? '').toLowerCase()),
    );
  }
  const platform = PLATFORMS.find(
    (p) => generators.some((g) => g.includes(p.generator)) || addresses.some((a) => p.hosts.some((h) => a.includes(h))),
  );
  return platform?.name ?? null;
}

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
  run: (page) =>
    withHtml(page, (view) => {
      // Read both versions. A tag manager can add a tool only in the rendered page.
      const sources = [page.rendered?.html, page.homepage.rawHtml].filter(
        (html): html is string => typeof html === 'string' && html !== '',
      );
      const haystack = sources.map(scriptText).join('\n');
      const tools = TOOLS.filter((t) => t.patterns.some((p) => haystack.includes(p))).map((t) => t.name);
      const evidence = { tools };
      if (tools.length > 0) return pass(evidence, view.source);
      const platform = detectPlatform(sources);
      if (platform !== null) {
        // The owner can read the statistics of the builder. A fail would be false.
        return {
          status: 'unable_to_check',
          severity: 'info',
          evidence: { tools, platform },
          source: view.source,
          unableReason: `This site uses ${platform}, which includes built-in visitor statistics.`,
        };
      }
      return { status: 'fail', severity: 'opportunity', evidence, source: view.source };
    }),
};

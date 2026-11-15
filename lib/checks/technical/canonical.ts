import type { Check } from '@/lib/types';
import { pass, unable, withHtml } from '@/lib/checks/helpers';

const withoutWww = (host: string) => host.toLowerCase().replace(/^www\./, '');

export const check: Check = {
  id: 'canonical',
  category: 'technical-seo',
  confidence: 'verified',
  run: (page) =>
    withHtml(page, ({ $, source }) => {
      const href = ($('link[rel~="canonical" i]').first().attr('href') ?? '').trim();
      if (href === '') {
        return { status: 'fail', severity: 'opportunity', evidence: { canonical: null }, source };
      }
      let resolved: URL;
      let pageUrl: URL;
      try {
        pageUrl = new URL(page.finalUrl);
        resolved = new URL(href, pageUrl);
      } catch {
        return unable('The canonical link could not be read', source);
      }
      if (resolved.hostname === '') return unable('The canonical link could not be read', source);
      const evidence = {
        canonical: href,
        resolved: resolved.href,
        canonicalHost: resolved.hostname,
        pageHost: pageUrl.hostname,
      };
      if (withoutWww(resolved.hostname) === withoutWww(pageUrl.hostname)) return pass(evidence, source);
      return { status: 'fail', severity: 'opportunity', evidence, source };
    }),
};

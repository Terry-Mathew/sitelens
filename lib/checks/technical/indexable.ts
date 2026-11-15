import type { Check, CheckOutcome } from '@/lib/types';
import { readHtml, homepageUnableReason, isJsShellFallback, JS_CONTENT_REASON, pass, unable } from '@/lib/checks/helpers';

/** Directives that stop indexing. `none` means `noindex, nofollow`. */
function findNoindex(value: string): string | null {
  for (const part of value.split(',')) {
    const token = part.trim().toLowerCase();
    if (token === 'noindex' || token === 'none') return token;
  }
  return null;
}

/**
 * Finds a noindex directive that applies to all crawlers in an X-Robots-Tag header.
 * A part such as `googlebot: noindex` names one crawler. The directives that follow it
 * belong to that crawler, so they are skipped.
 */
function headerNoindex(value: string): string | null {
  let scoped = false;
  for (const part of value.split(',')) {
    const named = /^\s*([a-z0-9_-]+)\s*:\s*(.*)$/i.exec(part);
    if (named && named[1].toLowerCase() !== 'unavailable_after') scoped = true;
    if (scoped) continue;
    const hit = findNoindex(part);
    if (hit) return hit;
  }
  return null;
}

export const check: Check = {
  id: 'indexable',
  category: 'technical-seo',
  confidence: 'verified',
  run(page): CheckOutcome {
    const view = readHtml(page);
    // Block pages, challenge pages, 404 and 5xx responses often send noindex.
    // Use the header only when the homepage was served normally.
    const { status, blocked, unreachableReason } = page.homepage;
    const served = status !== null && status >= 200 && status < 300 && !blocked && !unreachableReason;
    const header = served ? (page.homepage.headers['x-robots-tag'] ?? null) : null;
    if (!view && !served) return unable(homepageUnableReason(page));

    // In JavaScript-shell fallback the raw HTML is not the page that Google renders.
    // Read only the header then.
    const jsShell = isJsShellFallback(page);
    let metaRobots: string | null = null;
    if (view && !jsShell) {
      const tag = view.$('meta[name="robots" i]').first();
      if (tag.length > 0) metaRobots = (tag.attr('content') ?? '').trim();
      const hit = metaRobots === null ? null : findNoindex(metaRobots);
      if (hit && metaRobots !== null) {
        return {
          status: 'fail',
          severity: 'critical',
          evidence: { directive: hit, where: 'meta', value: metaRobots },
          source: view.source,
        };
      }
    }

    const headerHit = header === null ? null : headerNoindex(header);
    if (headerHit && header !== null) {
      return {
        status: 'fail',
        severity: 'critical',
        evidence: { directive: headerHit, where: 'header', value: header.trim() },
        source: 'headers',
      };
    }

    // Without HTML the meta tag is unknown, so a pass would be a guess.
    if (!view) return unable(homepageUnableReason(page), 'headers');
    if (jsShell) return unable(JS_CONTENT_REASON, view.source);
    return pass({ metaRobots, xRobotsTag: header === null ? null : header.trim() }, view.source);
  },
};

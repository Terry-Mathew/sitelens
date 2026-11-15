import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';

const NON_VISIBLE = 'script, style, noscript, template';
// Elements that start a new word. Minified HTML has no space between them.
const WORD_BREAK = 'p, div, h1, h2, h3, h4, h5, h6, li, ul, ol, section, article, header, footer, nav, main, aside, br, td, th, tr, blockquote, button, a, label, address';
const SHELL_ROOTS = '#root, #__next, #app, #___gatsby, #svelte, [data-reactroot], [ng-version], app-root';
const SHELL_WORD_LIMIT = 50;
// Markers of a bot challenge page. The direct fetch and the Firecrawl result use the same list.
export const CHALLENGE_MARKERS = ['cf-chl', 'challenge-platform', 'just a moment...'];

// One scan reads the same raw and rendered HTML in many checks. Keep the last few parsed documents.
const CACHE_SIZE = 4;
const documents = new Map<string, CheerioAPI>();
const texts = new WeakMap<CheerioAPI, string>();

/**
 * Parses HTML once and returns the same document for the same string.
 * Callers must not change the returned document, because other callers share it.
 */
export function loadHtml(html: string): CheerioAPI {
  const cached = documents.get(html);
  if (cached) {
    // Move the entry to the end, so the oldest entry is removed first.
    documents.delete(html);
    documents.set(html, cached);
    return cached;
  }
  const $ = cheerio.load(html);
  documents.set(html, $);
  if (documents.size > CACHE_SIZE) documents.delete(documents.keys().next().value as string);
  return $;
}

/** Text a visitor can read. Scripts, styles, noscript and templates are left out. */
export function visibleText($: CheerioAPI): string {
  const cached = texts.get($);
  if (cached !== undefined) return cached;
  // Work on a copy so the caller's document stays unchanged.
  const copy = cheerio.load($.html());
  copy(NON_VISIBLE).remove();
  copy(WORD_BREAK).after(' ');
  const text = copy('body').text().replace(/\s+/g, ' ').trim();
  texts.set($, text);
  return text;
}

/** True if the HTML holds a bot challenge marker. */
export function hasChallengeMarker(html: string): boolean {
  const lower = html.toLowerCase();
  return CHALLENGE_MARKERS.some((marker) => lower.includes(marker));
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/** Heuristic: the raw HTML has almost no text and has an empty app-root container. Script tags alone do not count. */
export function looksLikeJsShell(rawHtml: string): boolean {
  const $ = loadHtml(rawHtml);
  if (wordCount(visibleText($)) >= SHELL_WORD_LIMIT) return false;
  const copy = cheerio.load($.html());
  copy(NON_VISIBLE).remove();
  return copy('body')
    .find(SHELL_ROOTS)
    .toArray()
    .some((el) => copy(el).text().trim() === '');
}

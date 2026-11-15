import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';

const NON_VISIBLE = 'script, style, noscript, template';
const SHELL_ROOTS = '#root, #__next, #app';
const SHELL_WORD_LIMIT = 50;

export function loadHtml(html: string): CheerioAPI {
  return cheerio.load(html);
}

/** Text a visitor can read. Scripts, styles, noscript and templates are left out. */
export function visibleText($: CheerioAPI): string {
  // Work on a copy so the caller's document stays unchanged.
  const copy = cheerio.load($.html());
  copy(NON_VISIBLE).remove();
  return copy('body').text().replace(/\s+/g, ' ').trim();
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/** Heuristic: the raw HTML has almost no text and looks like a client-side app shell. */
export function looksLikeJsShell(rawHtml: string): boolean {
  const $ = loadHtml(rawHtml);
  if (wordCount(visibleText($)) >= SHELL_WORD_LIMIT) return false;
  const roots = $('body').find(SHELL_ROOTS);
  const hasEmptyRoot =
    roots.length === 1 && roots.children().length === 0 && roots.text().trim() === '';
  return hasEmptyRoot || $('script').length > 0;
}

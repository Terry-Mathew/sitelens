import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';

const NON_VISIBLE = 'script, style, noscript, template';
// Elements that start a new word. Minified HTML has no space between them.
const WORD_BREAK = 'p, div, h1, h2, h3, h4, h5, h6, li, ul, ol, section, article, header, footer, nav, main, aside, br, td, th, tr, blockquote, button, a, label, address';
const SHELL_ROOTS = '#root, #__next, #app, #___gatsby, #svelte, [data-reactroot], [ng-version], app-root';
const SHELL_WORD_LIMIT = 50;

export function loadHtml(html: string): CheerioAPI {
  return cheerio.load(html);
}

/** Text a visitor can read. Scripts, styles, noscript and templates are left out. */
export function visibleText($: CheerioAPI): string {
  // Work on a copy so the caller's document stays unchanged.
  const copy = cheerio.load($.html());
  copy(NON_VISIBLE).remove();
  copy(WORD_BREAK).after(' ');
  return copy('body').text().replace(/\s+/g, ' ').trim();
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

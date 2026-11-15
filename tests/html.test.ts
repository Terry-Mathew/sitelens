import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadHtml, looksLikeJsShell, visibleText, wordCount } from '@/lib/html';

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

describe('visibleText', () => {
  it('ignores scripts and styles', () => {
    const $ = loadHtml(
      '<html><head><title>T</title><style>.a{color:red}</style></head><body><p>Hello <b>world</b></p><script>var x = "secret";</script><noscript>enable js</noscript><template><p>tpl</p></template></body></html>',
    );
    expect(visibleText($)).toBe('Hello world');
  });

  it('keeps words apart when minified HTML has no space between elements', () => {
    const $ = loadHtml('<body><h1>Title</h1><p>First</p><a href="/">One</a><a href="/">Two</a><p>Hel<b>lo</b></p></body>');
    expect(visibleText($)).toBe('Title First One Two Hello');
  });

  it('does not change the loaded document', () => {
    const $ = loadHtml('<body><script>x</script><p>a</p></body>');
    visibleText($);
    expect($('script')).toHaveLength(1);
  });
});

describe('wordCount', () => {
  it('counts whitespace separated words', () => {
    expect(wordCount('  one two\nthree\t four ')).toBe(4);
    expect(wordCount('')).toBe(0);
  });
});

describe('looksLikeJsShell', () => {
  it('true for <div id="root"></div><script src=app.js>', () => {
    expect(looksLikeJsShell(readFileSync(join(__dirname, 'fixtures', 'js-shell.html'), 'utf8'))).toBe(true);
  });

  it('true for an empty #__next or #app root without scripts', () => {
    expect(looksLikeJsShell('<body><div id="__next"></div></body>')).toBe(true);
    expect(looksLikeJsShell('<body><div id="app"></div></body>')).toBe(true);
  });

  it('false for a page with plenty of visible text', () => {
    expect(looksLikeJsShell(`<body><div id="root"><p>${words(80)}</p></div><script src="a.js"></script></body>`)).toBe(false);
  });

  it('false for a short static page with an analytics script', () => {
    expect(looksLikeJsShell('<body><p>Short page</p><script src="https://example.com/analytics.js"></script></body>')).toBe(false);
  });

  it('false for a long page that has an empty #root', () => {
    expect(looksLikeJsShell(`<body><p>${words(80)}</p><div id="root"></div></body>`)).toBe(false);
  });

  it('true for other framework root containers', () => {
    expect(looksLikeJsShell('<body><div id="___gatsby"></div></body>')).toBe(true);
    expect(looksLikeJsShell('<body><div id="svelte"></div></body>')).toBe(true);
    expect(looksLikeJsShell('<body><div data-reactroot></div></body>')).toBe(true);
    expect(looksLikeJsShell('<body><div ng-version="17.0.0"></div></body>')).toBe(true);
    expect(looksLikeJsShell('<body><app-root></app-root></body>')).toBe(true);
  });

  it('false for a short static page with no scripts and no empty root', () => {
    expect(looksLikeJsShell('<body><p>Short page</p></body>')).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/content/word-count';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const pageWithWords = (n: number) => {
  const html = htmlPage('<title>x</title>', `<h1>Hi</h1><p>${Array(n).fill('word').join(' ')}</p><script>var a = "ignored words here";</script>`);
  return makePage({ rendered: { html }, homepage: { rawHtml: html } });
};

describe('word-count', () => {
  it('249 words → warning', () => {
    // The H1 adds one word, so 248 body words give 249.
    expect(check.run(pageWithWords(248))).toMatchObject({ status: 'fail', severity: 'warning', evidence: { words: 249 } });
  });

  it('250 words → passed', () => {
    expect(check.run(pageWithWords(249))).toMatchObject({ status: 'pass', severity: 'passed', evidence: { words: 250 } });
  });

  it('unable_to_check when the homepage could not be read', () => {
    expect(check.run(blockedPage()).status).toBe('unable_to_check');
  });

  it('unable_to_check for a JavaScript app that loaded as raw HTML', () => {
    const r = check.run(makePage({ rendered: null, loadedWith: 'direct-fallback', jsRendered: true }));
    expect(r).toMatchObject({ status: 'unable_to_check', unableReason: 'This site loads its content with JavaScript' });
  });
});

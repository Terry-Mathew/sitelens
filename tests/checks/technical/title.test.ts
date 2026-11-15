import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/title';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const withTitle = (head: string) => {
  const html = htmlPage(head);
  return makePage({ rendered: { html }, homepage: { rawHtml: html } });
};

describe('title', () => {
  it('45 chars → passed', () => {
    const text = 'a'.repeat(45);
    const r = check.run(withTitle(`<title>${text}</title>`));
    expect(r).toMatchObject({ status: 'pass', severity: 'passed', evidence: { text, length: 45 } });
  });

  it('30 and 60 chars are inside the range', () => {
    expect(check.run(withTitle(`<title>${'a'.repeat(30)}</title>`)).status).toBe('pass');
    expect(check.run(withTitle(`<title>${'a'.repeat(60)}</title>`)).status).toBe('pass');
  });

  it('missing → warning', () => {
    const r = check.run(withTitle(''));
    expect(r.status).toBe('fail');
    expect(r.severity).toBe('warning');
    expect(r.evidence).toMatchObject({ text: null, length: 0 });
  });

  it('empty title → warning', () => {
    expect(check.run(withTitle('<title>   </title>'))).toMatchObject({ severity: 'warning' });
  });

  it('25 chars → opportunity, evidence {text, length: 25}', () => {
    const text = 'a'.repeat(25);
    const r = check.run(withTitle(`<title>${text}</title>`));
    expect(r.status).toBe('fail');
    expect(r.severity).toBe('opportunity');
    expect(r.evidence).toEqual({ text, length: 25 });
  });

  it('61 chars → opportunity', () => {
    expect(check.run(withTitle(`<title>${'a'.repeat(61)}</title>`)).severity).toBe('opportunity');
  });

  it('trims the text only', () => {
    const r = check.run(withTitle(`<title>  ${'a'.repeat(45)}\n</title>`));
    expect(r.evidence).toMatchObject({ text: 'a'.repeat(45), length: 45 });
  });

  it('uses raw HTML when there is no rendered HTML', () => {
    const html = htmlPage(`<title>${'a'.repeat(45)}</title>`);
    const r = check.run(makePage({ rendered: null, homepage: { rawHtml: html } }));
    expect(r.source).toBe('raw');
    expect(r.status).toBe('pass');
  });

  it('unable_to_check when the homepage could not be read', () => {
    const r = check.run(blockedPage());
    expect(r.status).toBe('unable_to_check');
    expect(r.unableReason).toBe('This site blocked our automated check');
  });
});

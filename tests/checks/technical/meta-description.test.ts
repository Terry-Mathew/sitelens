import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/meta-description';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const withHead = (head: string) => {
  const html = htmlPage(head);
  return makePage({ rendered: { html }, homepage: { rawHtml: html } });
};
const desc = (n: number) => `<meta name="description" content="${'d'.repeat(n)}">`;

describe('meta-description', () => {
  it('100 chars → pass', () => {
    expect(check.run(withHead(desc(100)))).toMatchObject({ status: 'pass', severity: 'passed', evidence: { text: 'd'.repeat(100), length: 100 } });
  });

  it('70 and 160 chars are inside the range', () => {
    expect(check.run(withHead(desc(70))).status).toBe('pass');
    expect(check.run(withHead(desc(160))).status).toBe('pass');
  });

  it('missing → warning', () => {
    const r = check.run(withHead(''));
    expect(r).toMatchObject({ status: 'fail', severity: 'warning', evidence: { text: null, length: 0 } });
  });

  it('empty content → warning', () => {
    expect(check.run(withHead('<meta name="description" content="">')).severity).toBe('warning');
  });

  it('69 chars → opportunity', () => {
    const r = check.run(withHead(desc(69)));
    expect(r.severity).toBe('opportunity');
    expect(r.evidence).toEqual({ text: 'd'.repeat(69), length: 69 });
  });

  it('161 chars → opportunity', () => {
    expect(check.run(withHead(desc(161))).severity).toBe('opportunity');
  });

  it('matches the name case-insensitively', () => {
    expect(check.run(withHead(`<meta name="Description" content="${'d'.repeat(100)}">`)).status).toBe('pass');
  });

  it('unable_to_check when the homepage could not be read', () => {
    expect(check.run(blockedPage()).status).toBe('unable_to_check');
  });
});

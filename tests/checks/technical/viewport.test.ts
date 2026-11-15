import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/viewport';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const withHead = (head: string) => {
  const html = htmlPage(head);
  return makePage({ rendered: { html }, homepage: { rawHtml: html } });
};

describe('viewport', () => {
  it('present → pass', () => {
    const r = check.run(withHead('<meta name="viewport" content="width=device-width, initial-scale=1">'));
    expect(r).toMatchObject({ status: 'pass', severity: 'passed', evidence: { content: 'width=device-width, initial-scale=1' } });
  });

  it('missing → fail warning, never critical', () => {
    const r = check.run(withHead('<title>x</title>'));
    expect(r).toMatchObject({ status: 'fail', severity: 'warning', evidence: { content: null } });
  });

  it('unable_to_check when the homepage could not be read', () => {
    expect(check.run(blockedPage()).status).toBe('unable_to_check');
  });
});

import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/conversion/click-to-call';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const withBody = (body: string) => {
  const html = htmlPage('<title>x</title>', body);
  return makePage({ rendered: { html }, homepage: { rawHtml: html } });
};

describe('click-to-call', () => {
  it('tel: link → passed', () => {
    expect(check.run(withBody('<a href="tel:+441234">Call</a>'))).toMatchObject({ status: 'pass', evidence: { tel: true, count: 1 } });
  });

  it('no tel: link → opportunity', () => {
    expect(check.run(withBody('<a href="mailto:a@b.com">Mail</a>'))).toMatchObject({ status: 'fail', severity: 'opportunity', evidence: { tel: false } });
  });

  it('unable_to_check when the homepage could not be read', () => {
    expect(check.run(blockedPage()).status).toBe('unable_to_check');
  });

  it('unable_to_check for a JavaScript app that loaded as raw HTML', () => {
    const r = check.run(makePage({ rendered: null, loadedWith: 'direct-fallback', jsRendered: true }));
    expect(r.status).toBe('unable_to_check');
  });
});

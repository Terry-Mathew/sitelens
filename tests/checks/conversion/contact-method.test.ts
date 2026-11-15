import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/conversion/contact-method';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const withBody = (body: string) => {
  const html = htmlPage('<title>x</title>', body);
  return makePage({ rendered: { html }, homepage: { rawHtml: html } });
};

describe('contact-method', () => {
  it('none of tel:/mailto:/form → warning and never critical', () => {
    expect(check.run(withBody('<p>Hello</p>'))).toMatchObject({
      status: 'fail', severity: 'warning', evidence: { tel: false, mailto: false, form: false },
    });
  });

  it('evidence lists which were found', () => {
    expect(check.run(withBody('<a href="TEL:+441234">Call</a><form></form>'))).toMatchObject({
      status: 'pass', severity: 'passed', evidence: { tel: true, mailto: false, form: true },
    });
    expect(check.run(withBody('<a href="mailto:a@b.com">Mail</a>'))).toMatchObject({ evidence: { tel: false, mailto: true, form: false } });
  });

  it('unable_to_check when the homepage could not be read', () => {
    expect(check.run(blockedPage()).status).toBe('unable_to_check');
  });

  it('unable_to_check for a JavaScript app that loaded as raw HTML', () => {
    const r = check.run(makePage({ rendered: null, loadedWith: 'direct-fallback', jsRendered: true }));
    expect(r).toMatchObject({ status: 'unable_to_check', unableReason: 'This site loads its content with JavaScript' });
  });
});

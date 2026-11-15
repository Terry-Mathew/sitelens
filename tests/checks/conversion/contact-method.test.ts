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

  it('none found → evidence shows every method as false', () => {
    expect(check.run(withBody('<p>Hello</p><a href="/about">About us</a>')).evidence).toEqual({
      tel: false, mailto: false, form: false, contactPageLink: false, messaging: false, formEmbed: false,
    });
  });

  it.each([
    ['/contact', '<a href="/contact">Get a quote</a>'],
    ['/contact-us/', '<a href="https://example.com/contact-us/">Talk to us</a>'],
    ['/get-in-touch', '<a href="/get-in-touch?x=1">Reach us</a>'],
    ['/en/contact.html', '<a href="/en/contact.html">Reach us</a>'],
    ['link text "Contact"', '<a href="/p/42">Contact</a>'],
    ['link text "Contact us"', '<a href="/p/42"> Contact  Us </a>'],
  ])('a link to a contact page (%s) passes with contactPageLink', (_n, body) => {
    expect(check.run(withBody(body))).toMatchObject({
      status: 'pass', evidence: { contactPageLink: true, tel: false, mailto: false, form: false },
    });
  });

  it('does not count a page whose path only starts with "contact"', () => {
    expect(check.run(withBody('<a href="/contactless-payments">Payments</a>')).status).toBe('fail');
  });

  it.each([
    ['sms:', '<a href="SMS:+441234">Text us</a>'],
    ['wa.me', '<a href="https://wa.me/441234">Chat</a>'],
    ['api.whatsapp.com', '<a href="https://api.whatsapp.com/send?phone=441234">Chat</a>'],
  ])('a %s link passes with messaging', (_n, body) => {
    expect(check.run(withBody(body))).toMatchObject({ status: 'pass', evidence: { messaging: true } });
  });

  it('an embedded form in an iframe passes with formEmbed', () => {
    expect(check.run(withBody('<iframe src="https://forms.example.net/f/abc"></iframe>'))).toMatchObject({
      status: 'pass', evidence: { formEmbed: true, form: false },
    });
  });

  it('an iframe without "form" in its address does not count', () => {
    expect(check.run(withBody('<iframe src="https://www.youtube.com/embed/x"></iframe>')).status).toBe('fail');
  });

  it('unable_to_check when the homepage could not be read', () => {
    expect(check.run(blockedPage()).status).toBe('unable_to_check');
  });

  it('unable_to_check for a JavaScript app that loaded as raw HTML', () => {
    const r = check.run(makePage({ rendered: null, loadedWith: 'direct-fallback', jsRendered: true }));
    expect(r).toMatchObject({ status: 'unable_to_check', unableReason: 'This site loads its content with JavaScript' });
  });
});

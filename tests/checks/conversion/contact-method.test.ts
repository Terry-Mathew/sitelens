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
    expect(check.run(withBody('<a href="TEL:+441234">Call</a><form><textarea name="msg"></textarea></form>'))).toMatchObject({
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

  it.each([
    ['Typeform', 'https://acme.typeform.com/to/abc'],
    ['Google Forms', 'https://docs.google.com/forms/d/e/x/viewform'],
    ['forms.gle', 'https://forms.gle/abc'],
    ['Jotform', 'https://form.jotform.com/12345'],
    ['HubSpot', 'https://share.hsforms.com/abc'],
    ['Tally', 'https://tally.so/embed/abc'],
  ])('an embedded %s form in an iframe passes with formEmbed', (_n, src) => {
    expect(check.run(withBody(`<iframe src="${src}"></iframe>`))).toMatchObject({
      status: 'pass', evidence: { formEmbed: true, form: false },
    });
  });

  it.each([
    ['"platform" in the address', 'https://cdn.platform.example/x'],
    ['"information" in the address', 'https://example.com/information'],
    ['"form" in an unknown host', 'https://forms.example.net/f/abc'],
  ])('an iframe with %s does not count', (_n, src) => {
    expect(check.run(withBody(`<iframe src="${src}"></iframe>`)).status).toBe('fail');
  });

  it.each([
    ['a site search form', '<form role="search"><input type="search" name="s"></form>'],
    ['a search input', '<form action="/find"><input type="search" name="term"><input type="text" name="x"></form>'],
    ['a single "q" field', '<form><input name="q"></form>'],
    ['a search action', '<form action="/search"><input name="term"><input name="where"></form>'],
    ['a newsletter form', '<form action="/subscribe"><input type="email" name="email"><button>Join</button></form>'],
    ['an empty form', '<form></form>'],
  ])('%s does not count as a contact method', (_n, body) => {
    expect(check.run(withBody(body))).toMatchObject({ status: 'fail', evidence: { form: false } });
  });

  it.each([
    ['name, email and message', '<form><input name="name"><input type="email" name="email"><textarea name="msg"></textarea></form>'],
    ['a phone field', '<form><input type="tel" name="phone"></form>'],
    ['an email and a second text field', '<form><input type="email" name="email"><input type="text" name="name"></form>'],
  ])('a contact form with %s passes', (_n, body) => {
    expect(check.run(withBody(body))).toMatchObject({ status: 'pass', evidence: { form: true } });
  });

  it('a search form with a textarea still does not count', () => {
    expect(check.run(withBody('<form role="search"><textarea name="q"></textarea></form>')).status).toBe('fail');
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

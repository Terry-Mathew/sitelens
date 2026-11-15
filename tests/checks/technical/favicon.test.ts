import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/favicon';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const noIconHtml = htmlPage('<title>x</title>');

describe('favicon', () => {
  it('icon link tag → pass', () => {
    const r = check.run(makePage({ favicon: { icoStatus: 404 } }));
    expect(r).toMatchObject({ status: 'pass', severity: 'passed', evidence: { linkTag: true, icoStatus: 404 } });
  });

  it('/favicon.ico returns 200 → pass', () => {
    const r = check.run(makePage({ favicon: { icoStatus: 200 }, rendered: { html: noIconHtml }, homepage: { rawHtml: noIconHtml } }));
    expect(r.status).toBe('pass');
  });

  it('finds an icon link in the rendered HTML when the raw HTML had none', () => {
    const r = check.run(makePage({ favicon: { icoStatus: 404 } }));
    expect(r.status).toBe('pass');
    expect(r.evidence).toMatchObject({ linkTag: true });
  });

  it('no link and 404 → fail opportunity', () => {
    const r = check.run(makePage({ favicon: { icoStatus: 404 }, rendered: { html: noIconHtml }, homepage: { rawHtml: noIconHtml } }));
    expect(r.status).toBe('fail');
    expect(r.severity).toBe('opportunity');
    expect(r.evidence).toMatchObject({ linkTag: false, icoStatus: 404 });
  });

  it('no link and a 403 on /favicon.ico → unable_to_check', () => {
    const r = check.run(makePage({ favicon: { icoStatus: 403 }, rendered: { html: noIconHtml }, homepage: { rawHtml: noIconHtml } }));
    expect(r.status).toBe('unable_to_check');
  });

  it('no link and the icon request failed → unable_to_check', () => {
    const r = check.run(makePage({ favicon: { icoStatus: null }, rendered: { html: noIconHtml }, homepage: { rawHtml: noIconHtml } }));
    expect(r.status).toBe('unable_to_check');
  });

  it('no HTML and no icon status → unable_to_check', () => {
    const r = check.run({ ...blockedPage(), favicon: { icoStatus: null } });
    expect(r.status).toBe('unable_to_check');
    expect(r.unableReason).toBe('This site blocked our automated check');
  });

  it('no HTML but /favicon.ico is 200 → pass', () => {
    const r = check.run({ ...blockedPage(), favicon: { icoStatus: 200 } });
    expect(r.status).toBe('pass');
  });

  it('no HTML and a 404 → unable_to_check (the link tag is unknown)', () => {
    const r = check.run({ ...blockedPage(), favicon: { icoStatus: 404 } });
    expect(r.status).toBe('unable_to_check');
  });

  const withHead = (head: string, icoStatus: number | null = 404) => {
    const html = htmlPage(`<title>x</title>${head}`);
    return makePage({ favicon: { icoStatus }, rendered: { html }, homepage: { rawHtml: html } });
  };

  it('an empty data: icon link and a 404 → fail', () => {
    const r = check.run(withHead('<link rel="icon" href="data:,">'));
    expect(r).toMatchObject({ status: 'fail', severity: 'opportunity', evidence: { linkTag: false, icoStatus: 404 } });
  });

  it('an empty href and a 404 → fail', () => {
    expect(check.run(withHead('<link rel="icon" href="">')).status).toBe('fail');
  });

  it('an icon link with no href and a 404 → fail', () => {
    expect(check.run(withHead('<link rel="icon">')).status).toBe('fail');
  });

  it('an icon link with a real address → pass', () => {
    expect(check.run(withHead('<link rel="icon" href="/icon.png">'))).toMatchObject({ status: 'pass', evidence: { linkTag: true } });
  });

  it('an icon link with a data: image → pass', () => {
    expect(check.run(withHead('<link rel="shortcut icon" href="data:image/png;base64,iVBORw0KGgo=">')).status).toBe('pass');
  });

  it('a JavaScript app in fallback with no icon link and a 404 → unable_to_check', () => {
    const html = htmlPage('<title>x</title>');
    const r = check.run(makePage({
      favicon: { icoStatus: 404 }, rendered: null, homepage: { rawHtml: html }, loadedWith: 'direct-fallback', jsRendered: true,
    }));
    expect(r).toMatchObject({ status: 'unable_to_check', unableReason: 'This site loads its content with JavaScript' });
  });

  it('does not treat apple-touch-icon alone as an icon link', () => {
    expect(check.run(withHead('<link rel="apple-touch-icon" href="/a.png">')).status).toBe('fail');
  });

  it('finds an icon link in the raw HTML when the rendered HTML has none', () => {
    const r = check.run(makePage({
      favicon: { icoStatus: 404 }, rendered: { html: noIconHtml }, homepage: { rawHtml: htmlPage('<link rel="icon" href="/f.png">') },
    }));
    expect(r).toMatchObject({ status: 'pass', evidence: { linkTag: true } });
  });
});

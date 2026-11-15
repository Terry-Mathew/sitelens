import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/favicon';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const noIconHtml = htmlPage('<title>x</title>');

describe('favicon', () => {
  it('icon link tag → pass', () => {
    const r = check.run(makePage({ favicon: { linkTag: true, icoStatus: 404 } }));
    expect(r).toMatchObject({ status: 'pass', severity: 'passed', evidence: { linkTag: true, icoStatus: 404 } });
  });

  it('/favicon.ico returns 200 → pass', () => {
    const r = check.run(makePage({ favicon: { linkTag: false, icoStatus: 200 }, rendered: { html: noIconHtml }, homepage: { rawHtml: noIconHtml } }));
    expect(r.status).toBe('pass');
  });

  it('finds an icon link in the rendered HTML when the raw HTML had none', () => {
    const r = check.run(makePage({ favicon: { linkTag: false, icoStatus: 404 } }));
    expect(r.status).toBe('pass');
    expect(r.evidence).toMatchObject({ linkTag: true });
  });

  it('no link and 404 → fail opportunity', () => {
    const r = check.run(makePage({ favicon: { linkTag: false, icoStatus: 404 }, rendered: { html: noIconHtml }, homepage: { rawHtml: noIconHtml } }));
    expect(r.status).toBe('fail');
    expect(r.severity).toBe('opportunity');
    expect(r.evidence).toMatchObject({ linkTag: false, icoStatus: 404 });
  });

  it('no link and a 403 on /favicon.ico → unable_to_check', () => {
    const r = check.run(makePage({ favicon: { linkTag: false, icoStatus: 403 }, rendered: { html: noIconHtml }, homepage: { rawHtml: noIconHtml } }));
    expect(r.status).toBe('unable_to_check');
  });

  it('no link and the icon request failed → unable_to_check', () => {
    const r = check.run(makePage({ favicon: { linkTag: false, icoStatus: null }, rendered: { html: noIconHtml }, homepage: { rawHtml: noIconHtml } }));
    expect(r.status).toBe('unable_to_check');
  });

  it('no HTML and no icon status → unable_to_check', () => {
    const r = check.run({ ...blockedPage(), favicon: { linkTag: false, icoStatus: null } });
    expect(r.status).toBe('unable_to_check');
    expect(r.unableReason).toBe('This site blocked our automated check');
  });

  it('no HTML but /favicon.ico is 200 → pass', () => {
    const r = check.run({ ...blockedPage(), favicon: { linkTag: false, icoStatus: 200 } });
    expect(r.status).toBe('pass');
  });

  it('no HTML and a 404 → unable_to_check (the link tag is unknown)', () => {
    const r = check.run({ ...blockedPage(), favicon: { linkTag: false, icoStatus: 404 } });
    expect(r.status).toBe('unable_to_check');
  });
});

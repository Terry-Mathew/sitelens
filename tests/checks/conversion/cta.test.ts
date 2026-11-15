import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/conversion/cta';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const withBody = (body: string) => {
  const html = htmlPage('<title>x</title>', body);
  return makePage({ rendered: { html }, homepage: { rawHtml: html } });
};

describe('cta', () => {
  it('evidence.matches lists up to 5 matched texts', () => {
    const body = ['Contact us', 'Book now', 'Get a QUOTE', 'Call today', 'Shop', 'Order online']
      .map((t) => `<a href="/x">${t}</a>`).join('');
    const r = check.run(withBody(body));
    expect(r).toMatchObject({ status: 'pass', severity: 'passed' });
    expect(r.evidence.matches).toEqual(['Contact us', 'Book now', 'Get a QUOTE', 'Call today', 'Shop']);
  });

  it('matches button text and submit input value', () => {
    expect(check.run(withBody('<button> Get   started </button>')).evidence.matches).toEqual(['Get started']);
    expect(check.run(withBody('<input type="submit" value="Request a callback">')).evidence.matches).toEqual(['Request a callback']);
  });

  it('does not match inside another word', () => {
    expect(check.run(withBody('<a href="/x">Callum and Bookends</a>')).status).toBe('fail');
  });

  it('no matching link or button → opportunity with empty matches', () => {
    expect(check.run(withBody('<a href="/about">About</a><button>Menu</button>'))).toMatchObject({
      status: 'fail', severity: 'opportunity', evidence: { matches: [] },
    });
  });

  it('unable_to_check when the homepage could not be read', () => {
    expect(check.run(blockedPage()).status).toBe('unable_to_check');
  });

  it('unable_to_check for a JavaScript app that loaded as raw HTML', () => {
    const r = check.run(makePage({ rendered: null, loadedWith: 'direct-fallback', jsRendered: true }));
    expect(r.status).toBe('unable_to_check');
  });
});

import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/ai/machine-readable-contact';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const pageWith = (body: string, head = '') => {
  const html = htmlPage(head, body);
  return makePage({ rendered: { html }, homepage: { rawHtml: html } });
};
const ld = (json: string) => `<script type="application/ld+json">${json}</script>`;

describe('machine-readable-contact', () => {
  it('tel link and address element → pass', () => {
    expect(check.run(pageWith('<a href="tel:+441130000">Call</a><address>1 High St, Leeds</address>'))).toMatchObject({
      status: 'pass', severity: 'passed', evidence: { phoneFound: true, addressFound: true },
    });
  });

  it('tel link but no address → opportunity, evidence {phoneFound:true,addressFound:false}', () => {
    expect(check.run(pageWith('<a href="tel:+441130000">Call</a>'))).toMatchObject({
      status: 'fail', severity: 'opportunity', evidence: { phoneFound: true, addressFound: false },
    });
  });

  it('address but no phone → opportunity', () => {
    expect(check.run(pageWith('<address>1 High St</address>'))).toMatchObject({
      status: 'fail', severity: 'opportunity', evidence: { phoneFound: false, addressFound: true },
    });
  });

  it('uppercase TEL: scheme is accepted', () => {
    expect(check.run(pageWith('<a href="TEL:+441130000">Call</a><address>x</address>')).status).toBe('pass');
  });

  it('JSON-LD telephone and PostalAddress → pass', () => {
    const head = ld('{"@type":"LocalBusiness","telephone":"+44 113 000","address":{"@type":"PostalAddress","streetAddress":"1 High St"}}');
    expect(check.run(pageWith('<p>Hi</p>', head))).toMatchObject({ status: 'pass', evidence: { phoneFound: true, addressFound: true } });
  });

  it('JSON-LD address as a string, nested in @graph → address found', () => {
    const head = ld('{"@graph":[{"@type":"Organization","address":"1 High St, Leeds"}]}');
    expect(check.run(pageWith('<p>Hi</p>', head)).evidence.addressFound).toBe(true);
  });

  it('empty <address> element does not count', () => {
    expect(check.run(pageWith('<address>  </address>')).evidence.addressFound).toBe(false);
  });

  it('neither found → opportunity', () => {
    expect(check.run(pageWith('<p>Hi</p>'))).toMatchObject({
      status: 'fail', severity: 'opportunity', evidence: { phoneFound: false, addressFound: false },
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

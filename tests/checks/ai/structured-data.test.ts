import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/ai/structured-data';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const ld = (...blocks: string[]) =>
  htmlPage(blocks.map((b) => `<script type="application/ld+json">${b}</script>`).join(''));
const pageWith = (html: string) => makePage({ rendered: { html }, homepage: { rawHtml: html } });

describe('structured-data', () => {
  it('@graph containing LocalBusiness → passed', () => {
    const r = check.run(pageWith(ld('{"@context":"https://schema.org","@graph":[{"@type":"WebSite"},{"@type":"LocalBusiness","name":"X"}]}')));
    expect(r).toMatchObject({ status: 'pass', severity: 'passed', evidence: { types: ['WebSite', 'LocalBusiness'], invalidBlocks: 0 } });
  });

  it('Organization in a type array → passed', () => {
    expect(check.run(pageWith(ld('{"@type":["Thing","Organization"]}'))).status).toBe('pass');
  });

  it.each(['Plumber Business', 'HomeAndConstructionBusiness', 'Restaurant', 'Store', 'ProfessionalService', 'MedicalOrganization', 'LegalService'])(
    'accepts type %s',
    (type) => {
      expect(check.run(pageWith(ld(`{"@type":"${type.replace(' ', '')}"}`))).status).toBe('pass');
    },
  );

  it('no JSON-LD → opportunity', () => {
    expect(check.run(pageWith(htmlPage('')))).toMatchObject({
      status: 'fail', severity: 'opportunity', evidence: { types: [], invalidBlocks: 0 },
    });
  });

  it('only unrelated types → opportunity with the types listed', () => {
    expect(check.run(pageWith(ld('{"@type":"WebSite"}')))).toMatchObject({
      status: 'fail', severity: 'opportunity', evidence: { types: ['WebSite'] },
    });
  });

  it('invalid JSON block is counted, not thrown', () => {
    const r = check.run(pageWith(ld('{ broken', '{"@type":"Organization"}')));
    expect(r.status).toBe('pass');
    expect(r.evidence.invalidBlocks).toBe(1);
  });

  it('only invalid JSON → opportunity with invalidBlocks', () => {
    expect(check.run(pageWith(ld('{ broken')))).toMatchObject({ status: 'fail', evidence: { types: [], invalidBlocks: 1 } });
  });

  it('prefers rendered HTML', () => {
    const r = check.run(makePage({ rendered: { html: ld('{"@type":"Organization"}') }, homepage: { rawHtml: htmlPage('') } }));
    expect(r.status).toBe('pass');
    expect(r.source).toBe('rendered');
  });

  it('falls back to raw HTML', () => {
    const r = check.run(makePage({ rendered: null, homepage: { rawHtml: ld('{"@type":"Organization"}') } }));
    expect(r.status).toBe('pass');
    expect(r.source).toBe('raw');
  });

  it('unable_to_check when the homepage could not be read', () => {
    expect(check.run(blockedPage()).status).toBe('unable_to_check');
  });
});

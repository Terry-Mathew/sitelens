import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/indexable';
import { makePage, htmlPage } from '../../helpers/page';

const withRobots = (content: string) => {
  const html = htmlPage(`<meta name="robots" content="${content}">`);
  return { rendered: { html }, homepage: { rawHtml: html } };
};

describe('indexable', () => {
  it('passes for a normal page', () => {
    const r = check.run(makePage());
    expect(r).toMatchObject({ status: 'pass', severity: 'passed', evidence: { metaRobots: null, xRobotsTag: null } });
  });

  it('passes for index,follow', () => {
    expect(check.run(makePage(withRobots('index, follow'))).status).toBe('pass');
  });

  it('meta robots noindex → fail critical, evidence.directive "noindex", evidence.where "meta"', () => {
    const r = check.run(makePage(withRobots('noindex, nofollow')));
    expect(r.status).toBe('fail');
    expect(r.severity).toBe('critical');
    expect(r.evidence).toMatchObject({ directive: 'noindex', where: 'meta', value: 'noindex, nofollow' });
    expect(r.source).toBe('rendered');
  });

  it('reads raw HTML when there is no rendered HTML', () => {
    const r = check.run(makePage({ ...withRobots('NOINDEX'), rendered: null }));
    expect(r).toMatchObject({ status: 'fail', source: 'raw', evidence: { where: 'meta' } });
  });

  it('X-Robots-Tag noindex header → fail critical, evidence.where "header"', () => {
    const r = check.run(makePage({ homepage: { headers: { 'x-robots-tag': 'noindex' } } }));
    expect(r.status).toBe('fail');
    expect(r.severity).toBe('critical');
    expect(r.evidence).toMatchObject({ directive: 'noindex', where: 'header', value: 'noindex' });
    expect(r.source).toBe('headers');
  });

  it('ignores a header that is scoped to one named crawler', () => {
    const r = check.run(makePage({ homepage: { headers: { 'x-robots-tag': 'otherbot: noindex' } } }));
    expect(r.status).toBe('pass');
  });

  it('ignores a robots meta tag that names one crawler', () => {
    const html = htmlPage('<meta name="googlebot" content="noindex">');
    expect(check.run(makePage({ rendered: { html }, homepage: { rawHtml: html } })).status).toBe('pass');
  });

  it('is unable_to_check with no HTML and no headers', () => {
    const r = check.run(makePage({ homepage: { status: null, headers: {}, rawHtml: null, unreachableReason: 'The website could not be reached' }, rendered: null }));
    expect(r.status).toBe('unable_to_check');
    expect(r.unableReason).toBe('The website could not be reached');
  });

  it('with headers but no HTML, only a header noindex is a fail', () => {
    const base = { homepage: { rawHtml: null, blockReason: 'The homepage is not an HTML page' }, rendered: null } as const;
    expect(check.run(makePage({ ...base, homepage: { ...base.homepage, headers: { 'x-robots-tag': 'noindex' } } })).status).toBe('fail');
    // Without a header noindex the meta tag is unknown, so the result is not a pass.
    expect(check.run(makePage(base)).status).toBe('unable_to_check');
  });
});

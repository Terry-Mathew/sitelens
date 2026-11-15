import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/indexable';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

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

  it('blocked page with an X-Robots-Tag noindex header → unable_to_check', () => {
    const page = blockedPage();
    page.homepage.headers = { 'x-robots-tag': 'noindex' };
    const r = check.run(page);
    expect(r.status).toBe('unable_to_check');
    expect(r.severity).toBe('info');
  });

  it('503 with a noindex header → unable_to_check', () => {
    const r = check.run(
      makePage({
        homepage: { status: 503, unreachableReason: 'The website returned a server error', rawHtml: null, headers: { 'x-robots-tag': 'noindex' } },
        rendered: null,
      }),
    );
    expect(r.status).toBe('unable_to_check');
  });

  it('ignores the header of a blocked response but still reads rendered HTML', () => {
    const page = blockedPage();
    page.homepage.headers = { 'x-robots-tag': 'noindex' };
    page.rendered = { html: htmlPage('<title>x</title>') };
    expect(check.run(page).status).toBe('pass');
  });

  it('200 with a noindex header → fail critical', () => {
    const r = check.run(makePage({ homepage: { status: 200, headers: { 'x-robots-tag': 'noindex' } } }));
    expect(r).toMatchObject({ status: 'fail', severity: 'critical', evidence: { where: 'header' } });
  });
});

import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/technical/img-alt';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const withBody = (body: string) => {
  const html = htmlPage('<title>x</title>', body);
  return makePage({ rendered: { html }, homepage: { rawHtml: html } });
};

describe('img-alt', () => {
  it('all images have alt → pass', () => {
    const r = check.run(withBody('<img src="/a.jpg" alt="A"><img src="/b.jpg" alt="B">'));
    expect(r).toMatchObject({ status: 'pass', severity: 'passed', evidence: { missingCount: 0, totalCount: 2, examples: [] } });
  });

  it('alt="" counts as present', () => {
    const r = check.run(withBody('<img src="/a.jpg" alt="">'));
    expect(r.status).toBe('pass');
    expect(r.evidence).toMatchObject({ missingCount: 0 });
  });

  it('missing alt → warning with count and filenames', () => {
    const r = check.run(withBody('<img src="/images/a.jpg"><img src="https://cdn.example.com/b.png?v=2" alt="ok"><img src="c.webp">'));
    expect(r.status).toBe('fail');
    expect(r.severity).toBe('warning');
    expect(r.evidence).toEqual({ missingCount: 2, totalCount: 3, examples: ['a.jpg', 'c.webp'] });
  });

  it('examples hold at most the first 10 filenames', () => {
    const imgs = Array.from({ length: 12 }, (_, i) => `<img src="/img${i}.jpg">`).join('');
    const r = check.run(withBody(imgs));
    expect(r.evidence).toMatchObject({ missingCount: 12 });
    expect(r.evidence.examples).toEqual(Array.from({ length: 10 }, (_, i) => `img${i}.jpg`));
  });

  it('names an inline image without a filename', () => {
    const r = check.run(withBody('<img src="data:image/png;base64,AAAA"><img>'));
    expect(r.evidence.examples).toEqual(['(inline image)', '(no src)']);
  });

  it('no images → not_applicable', () => {
    const r = check.run(withBody('<p>No pictures</p>'));
    expect(r.status).toBe('not_applicable');
    expect(r.severity).toBe('info');
  });

  it('unable_to_check when the homepage could not be read', () => {
    expect(check.run(blockedPage()).status).toBe('unable_to_check');
  });
});

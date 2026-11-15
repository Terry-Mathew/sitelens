import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/content/copyright-year';
import { makePage, htmlPage, blockedPage } from '../../helpers/page';

const withFooter = (footer: string) => {
  const html = htmlPage('<title>x</title>', `<h1>Hi</h1><footer>${footer}</footer>`);
  return makePage({ rendered: { html }, homepage: { rawHtml: html }, scannedAt: '2026-11-15T10:00:00.000Z' });
};

describe('copyright-year', () => {
  it('© 2019 scanned 2026-11-15 → opportunity, evidence.year 2019', () => {
    expect(check.run(withFooter('© 2019 Example Ltd'))).toMatchObject({ status: 'fail', severity: 'opportunity', evidence: { year: 2019 } });
  });

  it('© 2025 → passed', () => {
    expect(check.run(withFooter('© 2025 Example Ltd'))).toMatchObject({ status: 'pass', severity: 'passed', evidence: { year: 2025 } });
  });

  it('© 2024 is stale (more than 1 year before 2026)', () => {
    expect(check.run(withFooter('© 2024 Example Ltd')).severity).toBe('opportunity');
  });

  it('range "© 2015–2026" uses the latest year → passed', () => {
    expect(check.run(withFooter('© 2015–2026 Example Ltd'))).toMatchObject({ status: 'pass', evidence: { year: 2026 } });
  });

  it('reads &copy; and the word copyright', () => {
    expect(check.run(withFooter('&copy; 2018 Example'))).toMatchObject({ evidence: { year: 2018 } });
    expect(check.run(withFooter('Copyright 2017 Example'))).toMatchObject({ evidence: { year: 2017 } });
  });

  it('no year found → not_applicable', () => {
    expect(check.run(withFooter('All rights reserved. Founded in 1998.'))).toMatchObject({ status: 'not_applicable', severity: 'info' });
  });

  it('ignores a year after the scan year', () => {
    expect(check.run(withFooter('© 2031 Example')).status).toBe('not_applicable');
  });

  it('uses the scan date and not the real clock', () => {
    const r = check.run({ ...withFooter('© 2019 Example'), scannedAt: '2020-03-01T00:00:00.000Z' });
    expect(r.status).toBe('pass');
  });

  it('unable_to_check when the homepage could not be read', () => {
    expect(check.run(blockedPage()).status).toBe('unable_to_check');
  });
});

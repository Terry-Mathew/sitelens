import { describe, it, expect } from 'vitest';
import { buildSummary } from '@/lib/report/summary';
import { defaultDraft, withPerformanceDefaults } from '@/lib/report/draft';
import { performanceFindings } from '@/lib/checks/performance';
import { formatDate, pageSize } from '@/lib/report/region';
import { CHECK_COPY } from '@/lib/content/checks';
import { finding, scanWith, psOk } from './fixtures';

const t = (id: string) => CHECK_COPY[id].clientTitle;
const intro = 'We reviewed the homepage of example.com on 15 November 2026.';

describe('buildSummary', () => {
  it('describes the selection with severity counts and the top 3 titles', () => {
    const s = scanWith([
      finding('https', 'fail', 'critical'),
      finding('indexable', 'fail', 'critical'),
      finding('title', 'fail', 'warning'),
      finding('favicon', 'fail', 'opportunity'),
    ]);
    expect(buildSummary(s, undefined, defaultDraft(s), 'UK')).toBe(
      `${intro} This report highlights 4 issues selected for review: 2 critical, 1 warning, and 1 opportunity. ` +
        `The most important are: ${t('https')}, ${t('indexable')}, and ${t('title')}.`,
    );
  });
  it('uses singular and plural correctly', () => {
    const one = scanWith([finding('title', 'fail', 'warning')]);
    expect(buildSummary(one, undefined, defaultDraft(one), 'UK')).toBe(
      `${intro} This report highlights 1 issue selected for review: 1 warning. The most important is: ${t('title')}.`,
    );
    const two = scanWith([finding('title', 'fail', 'warning'), finding('canonical', 'fail', 'warning')]);
    expect(buildSummary(two, undefined, defaultDraft(two), 'UK')).toBe(
      `${intro} This report highlights 2 issues selected for review: 2 warnings. ` +
        `The most important are: ${t('title')} and ${t('canonical')}.`,
    );
  });
  it('joins two severity parts with "and"', () => {
    const s = scanWith([
      finding('https', 'fail', 'critical'),
      finding('https', 'fail', 'critical'),
      finding('title', 'fail', 'warning'),
    ]);
    expect(buildSummary(s, undefined, defaultDraft(s), 'UK')).toContain(': 2 critical and 1 warning. ');
  });
  it('says nothing about problems when no failed finding exists', () => {
    const s = scanWith([finding('viewport', 'pass', 'passed')]);
    expect(buildSummary(s, undefined, defaultDraft(s), 'UK')).toBe(
      `${intro} We did not find significant issues in the areas we checked.`,
    );
  });
  it('never claims there are no issues when failed findings are excluded', () => {
    const s = scanWith([finding('https', 'fail', 'critical'), finding('viewport', 'pass', 'passed')]);
    const text = buildSummary(s, undefined, { ...defaultDraft(s), includedCheckIds: ['viewport'] }, 'UK');
    expect(text).toBe(`${intro} This report focuses on the areas you selected.`);
    expect(text).not.toMatch(/did not find|no issues/i);
  });
  it('does not claim a healthy site when failed performance findings are hidden', () => {
    const s = scanWith([finding('viewport', 'pass', 'passed')]);
    const o = psOk(true, 20);
    const d = { ...withPerformanceDefaults(defaultDraft(s), performanceFindings(o)), includePerformance: false };
    expect(buildSummary(s, o, d, 'UK')).toBe(`${intro} This report focuses on the areas you selected.`);
    const shown = buildSummary(s, o, { ...d, includePerformance: true }, 'UK');
    expect(shown).toContain('highlights 1 issue selected for review: 1 warning.');
  });
  it('does not count observations or info fails as issues', () => {
    const s = scanWith([finding('ai-crawlers', 'observation', 'info'), finding('llms-txt', 'fail', 'info')]);
    const d = { ...defaultDraft(s), includedCheckIds: ['ai-crawlers', 'llms-txt'] };
    expect(buildSummary(s, undefined, d, 'UK')).toBe(
      `${intro} We did not find significant issues in the areas we checked.`,
    );
  });
  it('appends the could-not-check count', () => {
    const s = scanWith([
      finding('title', 'fail', 'warning'),
      finding('sitemap', 'unable_to_check', 'info'),
      finding('robots-present', 'unable_to_check', 'info'),
      finding('canonical', 'unable_to_check', 'info'),
    ]);
    expect(buildSummary(s, undefined, defaultDraft(s), 'UK')).toMatch(/ 3 items could not be checked automatically\.$/);
    const one = scanWith([finding('sitemap', 'unable_to_check', 'info')]);
    expect(buildSummary(one, undefined, defaultDraft(one), 'UK')).toMatch(/ 1 item could not be checked automatically\.$/);
  });
  it('uses the US date format', () => {
    const s = scanWith([]);
    expect(buildSummary(s, undefined, defaultDraft(s), 'US')).toContain('on November 15, 2026.');
  });
});

describe('region', () => {
  it('formats dates in UTC', () => {
    expect(formatDate('2026-11-15T23:59:00.000Z', 'UK')).toBe('15 November 2026');
    expect(formatDate('2026-11-15T23:59:00.000Z', 'US')).toBe('November 15, 2026');
  });
  it('returns the page size', () => {
    expect(pageSize('UK')).toBe('A4');
    expect(pageSize('US')).toBe('LETTER');
  });
});

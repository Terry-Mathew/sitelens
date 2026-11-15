import { describe, it, expect } from 'vitest';
import { defaultDraft, isToggleable, reportSections, withPerformanceDefaults } from '@/lib/report/draft';
import { performanceFindings } from '@/lib/checks/performance';
import { finding, scanWith, psOk, psFail } from './fixtures';

const scan = scanWith([
  finding('https', 'fail', 'critical'),
  finding('title', 'fail', 'warning'),
  finding('favicon', 'fail', 'opportunity'),
  finding('llms-txt', 'fail', 'info'),
  finding('viewport', 'pass', 'passed'),
  finding('ai-crawlers', 'observation', 'info'),
  finding('sitemap', 'unable_to_check', 'info'),
  finding('click-to-call', 'not_applicable', 'info'),
]);

describe('defaultDraft', () => {
  it('includes fail findings except info, includes passed, excludes observations', () => {
    const d = defaultDraft(scan);
    expect(d.scanId).toBe('scan-1');
    expect(d.includedCheckIds.sort()).toEqual(['favicon', 'https', 'title', 'viewport']);
    expect(d.includePerformance).toBe(true);
  });
});

describe('isToggleable', () => {
  it('is true for fail, pass, observation only', () => {
    expect(isToggleable(finding('a', 'fail', 'warning'))).toBe(true);
    expect(isToggleable(finding('a', 'pass', 'passed'))).toBe(true);
    expect(isToggleable(finding('a', 'observation', 'info'))).toBe(true);
    expect(isToggleable(finding('a', 'unable_to_check', 'info'))).toBe(false);
    expect(isToggleable(finding('a', 'not_applicable', 'info'))).toBe(false);
  });
  it('treats performance findings like the others', () => {
    const [lab, field] = performanceFindings(psOk(false));
    expect(isToggleable(lab)).toBe(true);
    expect(isToggleable(field)).toBe(false); // unable_to_check
    expect(isToggleable(performanceFindings(psOk(true))[1])).toBe(true);
  });
});

describe('withPerformanceDefaults', () => {
  it('adds failed and passed performance ids once and never unable ids', () => {
    const perf = performanceFindings(psOk(false));
    const d = withPerformanceDefaults(defaultDraft(scan), perf);
    expect(d.includedCheckIds).toContain('lab-performance');
    expect(d.includedCheckIds).not.toContain('field-cwv');
    const again = withPerformanceDefaults(d, perf);
    expect(again.includedCheckIds.filter((id) => id === 'lab-performance')).toHaveLength(1);
  });
  it('does not set the flag when the performance list is empty', () => {
    const d = withPerformanceDefaults(defaultDraft(scan), []);
    expect(d.performanceDefaulted).toBeUndefined();
    const later = withPerformanceDefaults(d, performanceFindings(psOk(true)));
    expect(later.includedCheckIds).toContain('lab-performance');
  });
  it('does not re-add an id the user excluded after the first call', () => {
    const perf = performanceFindings(psOk(true));
    const d = withPerformanceDefaults(defaultDraft(scan), perf);
    const excluded = { ...d, includedCheckIds: d.includedCheckIds.filter((id) => id !== 'lab-performance') };
    expect(withPerformanceDefaults(excluded, perf).includedCheckIds).not.toContain('lab-performance');
  });
});

describe('reportSections', () => {
  it('sorts included fails by severity then registry order', () => {
    const s = scanWith([
      finding('favicon', 'fail', 'opportunity'),
      finding('title', 'fail', 'warning'),
      finding('https', 'fail', 'critical'),
      finding('canonical', 'fail', 'warning'),
    ]);
    const r = reportSections(s, undefined, defaultDraft(s));
    expect(r.findings.map((f) => f.checkId)).toEqual(['https', 'title', 'canonical', 'favicon']);
  });
  it('always lists unable_to_check findings regardless of draft', () => {
    const r = reportSections(scan, psOk(false), { ...defaultDraft(scan), includedCheckIds: [] });
    expect(r.couldNotCheck.map((f) => f.checkId).sort()).toEqual(['field-cwv', 'sitemap']);
  });
  it('hides performance when includePerformance is false', () => {
    const d = { ...withPerformanceDefaults(defaultDraft(scan), performanceFindings(psOk(true))), includePerformance: false };
    const r = reportSections(scan, psOk(true), d);
    expect(r.performance).toBeNull();
    expect(r.findings.some((f) => f.category === 'performance')).toBe(false);
    expect(r.passed.some((f) => f.category === 'performance')).toBe(false);
    expect(r.couldNotCheck.some((f) => f.category === 'performance')).toBe(false);
    expect(r.limitations).not.toContain('performance_unavailable');
  });
  it('shows performance fail findings and data when included', () => {
    const o = psOk(true, 20);
    const d = withPerformanceDefaults(defaultDraft(scan), performanceFindings(o));
    const r = reportSections(scan, o, d);
    expect(r.performance).toBe(o);
    expect(r.findings.map((f) => f.checkId)).toContain('lab-performance');
  });
  it('never puts an excluded failed finding in the passed list', () => {
    const d = { ...defaultDraft(scan), includedCheckIds: ['viewport'] };
    const r = reportSections(scan, undefined, d);
    expect(r.passed.map((f) => f.checkId)).toEqual(['viewport']);
    expect(r.findings).toEqual([]);
  });
  it('sets selectionNote when a non-info failed finding is excluded', () => {
    expect(reportSections(scan, undefined, defaultDraft(scan)).selectionNote).toBe(false);
    const d = { ...defaultDraft(scan), includedCheckIds: ['https', 'viewport'] };
    expect(reportSections(scan, undefined, d).selectionNote).toBe(true);
  });
  it('flags hidden failed performance findings as a selection', () => {
    const s = scanWith([finding('viewport', 'pass', 'passed')]);
    const o = psOk(true, 20);
    const d = { ...withPerformanceDefaults(defaultDraft(s), performanceFindings(o)), includePerformance: false };
    expect(reportSections(s, o, d).selectionNote).toBe(true);
    expect(reportSections(s, o, { ...d, includePerformance: true }).selectionNote).toBe(false);
  });
  it('lists included observations separately', () => {
    const d = { ...defaultDraft(scan), includedCheckIds: [...defaultDraft(scan).includedCheckIds, 'ai-crawlers'] };
    const r = reportSections(scan, undefined, d);
    expect(r.observations.map((f) => f.checkId)).toEqual(['ai-crawlers']);
  });
  it('adds performance limitations once', () => {
    const s = scanWith([], { limitations: ['performance_unavailable'] });
    expect(reportSections(s, psFail, defaultDraft(s)).limitations).toEqual(['performance_unavailable']);
    expect(reportSections(scan, psOk(false), defaultDraft(scan)).limitations).toEqual(['field_data_unavailable']);
    expect(reportSections(scan, psFail, defaultDraft(scan)).limitations).toEqual(['performance_unavailable']);
    expect(reportSections(scan, psOk(true), defaultDraft(scan)).limitations).toEqual([]);
  });
  it('does not change the ScanResult', () => {
    const before = structuredClone(scan);
    const d = defaultDraft(scan);
    reportSections(scan, psOk(true), d);
    reportSections(scan, undefined, { ...d, includedCheckIds: [] });
    expect(scan).toEqual(before);
  });
});

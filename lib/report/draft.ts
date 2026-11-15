import { performanceFindings } from '@/lib/checks/performance';
import type { PageSpeedOutcome } from '@/lib/performance';
import type { Finding, LimitationCode, ScanResult } from '@/lib/types';

export interface ReportDraft {
  scanId: string;
  includedCheckIds: string[];
  includePerformance: boolean;
  // True after the performance defaults were added once. Stops a second add from undoing a user choice.
  performanceDefaulted?: boolean;
  clientBusinessName?: string;
  nextSteps?: string;
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, opportunity: 2 };

// Spec 7.1a: failed findings (not info) and passed findings are included. Observations are not.
function isDefaultIncluded(f: Finding): boolean {
  return (f.status === 'fail' && f.severity !== 'info') || f.status === 'pass';
}

export function defaultDraft(scan: ScanResult): ReportDraft {
  return {
    scanId: scan.id,
    includedCheckIds: scan.findings.filter(isDefaultIncluded).map((f) => f.checkId),
    includePerformance: true,
  };
}

// Call this once when PageSpeed data arrives. It adds the failed and passed performance findings.
export function withPerformanceDefaults(draft: ReportDraft, performance: Finding[]): ReportDraft {
  if (draft.performanceDefaulted) return draft;
  const ids = performance.filter(isDefaultIncluded).map((f) => f.checkId);
  return {
    ...draft,
    includedCheckIds: [...draft.includedCheckIds, ...ids.filter((id) => !draft.includedCheckIds.includes(id))],
    performanceDefaulted: true,
  };
}

export function isToggleable(f: Finding): boolean {
  return f.status === 'fail' || f.status === 'pass' || f.status === 'observation';
}

// Sort by severity. Array.sort is stable, so the scan order (registry order) stays inside each group.
export function bySeverity(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3));
}

export function reportFindings(scan: ScanResult, pagespeed: PageSpeedOutcome | undefined, draft: ReportDraft): Finding[] {
  const performance = draft.includePerformance && pagespeed ? performanceFindings(pagespeed) : [];
  return [...scan.findings, ...performance];
}

export interface ReportSections {
  findings: Finding[];
  passed: Finding[];
  observations: Finding[];
  couldNotCheck: Finding[];
  performance: PageSpeedOutcome | null;
  selectionNote: boolean;
  limitations: LimitationCode[];
}

export function reportSections(
  scan: ScanResult,
  pagespeed: PageSpeedOutcome | undefined,
  draft: ReportDraft,
): ReportSections {
  const all = reportFindings(scan, pagespeed, draft);
  const included = (f: Finding) => draft.includedCheckIds.includes(f.checkId);
  const isIssue = (f: Finding) => f.status === 'fail' && f.severity !== 'info';

  const limitations = new Set<LimitationCode>(scan.limitations);
  if (draft.includePerformance && pagespeed) {
    if (!pagespeed.ok) limitations.add('performance_unavailable');
    else if (!pagespeed.data.field) limitations.add('field_data_unavailable');
  }

  return {
    findings: bySeverity(all.filter((f) => isIssue(f) && included(f))),
    passed: all.filter((f) => f.status === 'pass' && included(f)),
    observations: all.filter((f) => f.status === 'observation' && included(f)),
    couldNotCheck: all.filter((f) => f.status === 'unable_to_check'),
    performance: draft.includePerformance ? (pagespeed ?? null) : null,
    selectionNote: all.some((f) => isIssue(f) && !included(f)),
    limitations: [...limitations],
  };
}

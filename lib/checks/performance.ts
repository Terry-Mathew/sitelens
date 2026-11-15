import type { PageSpeedOutcome, PageSpeedResult } from '@/lib/performance';
import type { Finding } from '@/lib/types';

// Spec 7.3: a Lighthouse performance score below 50 is a warning.
const LAB_WARNING_BELOW = 50;
const NO_FIELD_REASON = 'Google does not have enough real-user data for this site.';

const base = { category: 'performance', confidence: 'verified', source: 'pagespeed' } as const;

function unableFinding(checkId: string, reason: string): Finding {
  return { ...base, checkId, status: 'unable_to_check', severity: 'info', evidence: {}, unableReason: reason };
}

function labFinding(data: PageSpeedResult): Finding {
  const score = data.lab.scores.performance;
  const evidence = { score };
  return score < LAB_WARNING_BELOW
    ? { ...base, checkId: 'lab-performance', status: 'fail', severity: 'warning', evidence }
    : { ...base, checkId: 'lab-performance', status: 'pass', severity: 'passed', evidence };
}

function fieldFinding(data: PageSpeedResult): Finding {
  const field = data.field;
  if (!field) return unableFinding('field-cwv', NO_FIELD_REASON);

  const metrics = { lcp: field.lcp, inp: field.inp, cls: field.cls };
  const poor = Object.entries(metrics)
    .filter(([, metric]) => metric?.rating === 'poor')
    .map(([name]) => name);
  if (poor.length > 0) {
    return {
      ...base,
      checkId: 'field-cwv',
      status: 'fail',
      severity: 'warning',
      evidence: { poor, scope: field.scope },
    };
  }
  // Include only the metrics that Google returned.
  const present = Object.fromEntries(Object.entries(metrics).filter(([, metric]) => metric !== undefined));
  return {
    ...base,
    checkId: 'field-cwv',
    status: 'pass',
    severity: 'passed',
    evidence: { ...present, scope: field.scope },
  };
}

/** Findings from the PageSpeed outcome. The client computes them, so they are not in the check registry. */
export function performanceFindings(outcome: PageSpeedOutcome): Finding[] {
  if (!outcome.ok) {
    return [
      unableFinding('lab-performance', outcome.unavailable),
      unableFinding('field-cwv', outcome.unavailable),
    ];
  }
  return [labFinding(outcome.data), fieldFinding(outcome.data)];
}

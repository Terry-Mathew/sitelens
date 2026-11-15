import type { Check, Finding, PageData } from '@/lib/types';
import { checks } from '@/lib/checks/registry';

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

export function runChecks(page: PageData, registry: Check[] = checks): Finding[] {
  return registry.map((check) => {
    let finding: Finding;
    try {
      const outcome = check.run(page);
      finding = {
        ...outcome,
        checkId: check.id,
        category: check.category,
        confidence: check.confidence,
      };
    } catch {
      finding = {
        checkId: check.id,
        category: check.category,
        confidence: check.confidence,
        status: 'unable_to_check',
        severity: 'info',
        evidence: {},
        source: 'raw',
        unableReason: 'Internal check error',
      };
    }
    return deepFreeze(finding);
  });
}

import { describe, it, expect } from 'vitest';
import { check } from '@/lib/checks/ai/llms-txt';
import { makePage } from '../../helpers/page';

describe('llms-txt', () => {
  it('present → observation', () => {
    expect(check.run(makePage({ llmsTxt: { present: true } }))).toMatchObject({
      status: 'observation', severity: 'info', evidence: { present: true },
    });
  });

  it('absent → observation, not a failure', () => {
    expect(check.run(makePage({ llmsTxt: { present: false } }))).toMatchObject({
      status: 'observation', severity: 'info', evidence: { present: false },
    });
  });

  it('null → unable_to_check', () => {
    const r = check.run(makePage({ llmsTxt: { present: null } }));
    expect(r.status).toBe('unable_to_check');
    expect(r.unableReason).toBeTruthy();
  });
});

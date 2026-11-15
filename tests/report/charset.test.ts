import { describe, expect, it } from 'vitest';
import { hasUnprintableText, isPrintable } from '@/lib/report/charset';
import { defaultDraft } from '@/lib/report/draft';
import type { Finding } from '@/lib/types';
import { scanWith } from './fixtures';

function fail(checkId: string, evidence: Record<string, unknown>): Finding {
  return {
    checkId,
    category: 'technical-seo',
    status: 'fail',
    severity: 'warning',
    confidence: 'verified',
    evidence,
    source: 'rendered',
  };
}

describe('isPrintable', () => {
  it('accepts every Windows-1252 character', () => {
    expect(isPrintable('Smith & Sons, café – “quoted” ’ € £ é ß Œ ™ …\n\t')).toBe(true);
  });
  it('rejects characters outside Windows-1252', () => {
    for (const text of ['Привет', 'Łódź', 'Ωmega', '東京', 'Shop 🛠', 'a​b', '→']) {
      expect(isPrintable(text)).toBe(false);
    }
  });
});

describe('hasUnprintableText', () => {
  const scan = scanWith([fail('title', { text: 'Plumbers in Leeds', length: 17 })]);
  const base = { scan, pagespeed: undefined, draft: defaultDraft(scan), branding: { region: 'UK' as const } };

  it('is false for a Latin report', () => {
    expect(hasUnprintableText(base)).toBe(false);
  });
  it('finds unprintable evidence, including nested values, in included findings only', () => {
    const cyr = scanWith([fail('title', { text: 'Сантехник', length: 9 })]);
    expect(hasUnprintableText({ ...base, scan: cyr, draft: defaultDraft(cyr) })).toBe(true);
    expect(hasUnprintableText({ ...base, scan: cyr, draft: { ...defaultDraft(cyr), includedCheckIds: [] } })).toBe(
      false,
    );
    const nested = scanWith([fail('img-alt', { files: ['ok.jpg', { name: 'łódź.jpg' }] })]);
    expect(hasUnprintableText({ ...base, scan: nested, draft: defaultDraft(nested) })).toBe(true);
  });
  it('finds unprintable branding, client name, and next steps', () => {
    expect(hasUnprintableText({ ...base, branding: { region: 'UK', name: 'Ōkami Web' } })).toBe(true);
    expect(hasUnprintableText({ ...base, branding: { region: 'UK', contact: 'hi@例え.jp' } })).toBe(true);
    expect(hasUnprintableText({ ...base, draft: { ...base.draft, clientBusinessName: 'Łódź Dental' } })).toBe(true);
    expect(hasUnprintableText({ ...base, draft: { ...base.draft, nextSteps: 'Call me 📞' } })).toBe(true);
  });
  it('finds an unprintable unable reason', () => {
    const s = scanWith([
      { ...fail('sitemap', {}), status: 'unable_to_check', severity: 'info', unableReason: 'Ошибка' },
    ]);
    expect(hasUnprintableText({ ...base, scan: s, draft: defaultDraft(s) })).toBe(true);
  });
});

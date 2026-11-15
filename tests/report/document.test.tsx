// @vitest-environment node
// The PDF renders in Node, so this file reads the text of a real PDF file.
import { describe, expect, it } from 'vitest';
import { ReportDocument, type ReportDocumentProps } from '@/components/report/ReportDocument';
import { CHECK_COPY } from '@/lib/content/checks';
import { LIMITATION_TEXT } from '@/lib/content/limitations';
import { defaultDraft, type ReportDraft } from '@/lib/report/draft';
import { buildSummary } from '@/lib/report/summary';
import type { Branding } from '@/lib/storage';
import type { Finding, ScanResult } from '@/lib/types';
import { normalise, renderPdf } from './pdf-text';
import { psOk } from './fixtures';

function f(
  checkId: string,
  status: Finding['status'],
  severity: Finding['severity'],
  over: Partial<Finding> = {},
): Finding {
  return {
    checkId,
    category: 'technical-seo',
    status,
    severity,
    confidence: 'verified',
    evidence: {},
    source: 'rendered',
    ...over,
  };
}

const findings: Finding[] = [
  f('https', 'fail', 'critical', {
    evidence: { finalUrl: 'http://example.com/' },
  }),
  f('title', 'fail', 'opportunity', {
    evidence: { text: 'Smith & Sons Plumbing Ltd', length: 25 },
  }),
  f('favicon', 'fail', 'opportunity', { evidence: { linkTag: false } }),
  f('cta', 'fail', 'warning', {
    category: 'conversion',
    confidence: 'heuristic',
    evidence: { candidates: 0 },
  }),
  f('viewport', 'pass', 'passed', {
    evidence: { content: 'width=device-width' },
  }),
  f('ai-crawlers', 'observation', 'info', {
    category: 'ai-readiness',
    evidence: { blocked: ['GPTBot'] },
  }),
  f('sitemap', 'unable_to_check', 'info', {
    source: 'sitemap',
    unableReason: 'The sitemap could not be read.',
  }),
];

const scan: ScanResult = {
  id: 'scan-1',
  url: 'https://example.com/',
  finalUrl: 'https://www.example.com/',
  scannedAt: '2026-11-15T10:00:00.000Z',
  findings,
  jsRendered: false,
  loadedWith: 'firecrawl',
  limitations: [],
};

const uk: Branding = { region: 'UK' };

function props(over: Partial<ReportDocumentProps> = {}): ReportDocumentProps {
  return {
    scan,
    pagespeed: undefined,
    draft: defaultDraft(scan),
    branding: uk,
    ...over,
  };
}

async function text(over: Partial<ReportDocumentProps> = {}): Promise<string> {
  return (await renderPdf(<ReportDocument {...props(over)} />)).text;
}

function without(draft: ReportDraft, checkId: string): ReportDraft {
  return {
    ...draft,
    includedCheckIds: draft.includedCheckIds.filter((id) => id !== checkId),
  };
}

describe('ReportDocument', () => {
  it('includes only included findings and every unable_to_check item', async () => {
    const t = await text({ draft: without(defaultDraft(scan), 'favicon') });
    expect(t).toContain(CHECK_COPY.https.clientTitle);
    expect(t).toContain(CHECK_COPY.title.clientTitle);
    expect(t).not.toContain(CHECK_COPY.favicon.clientTitle);
    expect(t).toContain('What we could not check');
    expect(t).toContain(CHECK_COPY.sitemap.title);
    expect(t).toContain('The sitemap could not be read.');

    const none = await text({
      draft: { ...defaultDraft(scan), includedCheckIds: [] },
    });
    expect(none).toContain('The sitemap could not be read.');
    expect(none).not.toContain(CHECK_COPY.https.clientTitle);
  });

  it('shows the parts of a finding and marks a heuristic finding', async () => {
    const t = await text();
    expect(t).toContain('What we found');
    expect(t).toContain(normalise(CHECK_COPY.https.whyItMatters));
    expect(t).toContain(normalise(CHECK_COPY.https.howToFix));
    expect(t).toContain('Recommended fix');
    expect(t).toContain('Critical');
    expect(t.match(/Observation from page code/g)).toHaveLength(1);
  });

  it('prints the summary with lower-case client titles in the middle of the sentence', async () => {
    const t = await text();
    expect(t).toContain(
      'The most important are: your website does not use a secure connection, we could not find a clear ' +
        'call-to-action button or link on your homepage, and your homepage title needs attention.',
    );
  });

  it('prints the selection note directly under the summary and in the scope section', async () => {
    const note = 'This report presents a selection of findings from the review.';
    const draft = without(defaultDraft(scan), 'favicon');
    const t = await text({ draft });
    const summary = normalise(buildSummary(scan, undefined, draft, 'UK'));
    expect(t).toContain(`${summary} ${note} Findings`);
    expect(t.split(note)).toHaveLength(3);
  });

  it('adds a scope line when some characters cannot be shown in the PDF font', async () => {
    const line = 'Some characters could not be shown in this PDF font.';
    expect(await text()).not.toContain(line);
    expect(await text({ draft: { ...defaultDraft(scan), clientBusinessName: 'Łódź Dental' } })).toContain(line);
  });

  it('puts the summary text in the report', async () => {
    const t = await text();
    expect(t).toContain(normalise(buildSummary(scan, undefined, defaultDraft(scan), 'UK')));
  });

  it('lists included passes under what is working well with a neutral title', async () => {
    const t = await text();
    expect(t).toContain('What is working well');
    expect(t).toContain(CHECK_COPY.viewport.title);
    expect(t).not.toContain(CHECK_COPY.viewport.clientTitle);
    const excluded = await text({
      draft: without(defaultDraft(scan), 'viewport'),
    });
    expect(excluded).not.toContain('What is working well');
  });

  it('shows observations only when the draft includes one', async () => {
    expect(await text()).not.toContain(CHECK_COPY['ai-crawlers'].clientTitle);
    const draft = defaultDraft(scan);
    const t = await text({
      draft: {
        ...draft,
        includedCheckIds: [...draft.includedCheckIds, 'ai-crawlers'],
      },
    });
    expect(t).toContain('Observations');
    expect(t).toContain(CHECK_COPY['ai-crawlers'].clientTitle);
    expect(t).toContain('GPTBot');
  });

  it('omits performance section when includePerformance false', async () => {
    const t = await text({
      pagespeed: psOk(true, 42),
      draft: { ...defaultDraft(scan), includePerformance: false },
    });
    expect(t).not.toContain('Google Lighthouse (lab test, mobile)');
    expect(t).not.toContain('Real-user data from Google');
  });

  it('shows lab and field blocks, or the missing-data texts, when performance is included', async () => {
    const ok = await text({ pagespeed: psOk(true, 42) });
    expect(ok).toContain('Google Lighthouse (lab test, mobile)');
    expect(ok).toContain('Real-user data from Google');
    expect(ok).toMatch(/Performance\s*42/);
    expect(ok).toContain('Data for: this page');

    const noField = await text({ pagespeed: psOk(false) });
    expect(noField).toContain('Real-user data from Google');
    expect(noField).toContain(LIMITATION_TEXT.field_data_unavailable);

    const failed = await text({
      pagespeed: { ok: false, unavailable: 'Timed out.' },
    });
    expect(failed).toContain(LIMITATION_TEXT.performance_unavailable);
    expect(failed).not.toContain('Google Lighthouse (lab test, mobile)');

    const missing = await text({ pagespeed: undefined });
    expect(missing).toContain(LIMITATION_TEXT.performance_unavailable);
  });

  it('omits the "What we could not check" section when there are none', async () => {
    const clean = {
      ...scan,
      findings: findings.filter((x) => x.status !== 'unable_to_check'),
    };
    const t = await text({
      scan: clean,
      draft: { ...defaultDraft(clean), includePerformance: false },
    });
    expect(t).not.toContain('What we could not check');
  });

  it('adds the selection note to scope when a failed finding is excluded', async () => {
    const note = 'This report presents a selection of findings from the review.';
    expect(await text()).not.toContain(note);
    expect(await text({ draft: without(defaultDraft(scan), 'favicon') })).toContain(note);
  });

  it('lists limitation texts in the scope section', async () => {
    const limited = {
      ...scan,
      limitations: ['js_fallback', 'sitemap_unavailable'] as ScanResult['limitations'],
    };
    const t = await text({ scan: limited, pagespeed: psOk(false) });
    expect(t).toContain('Scope and limitations');
    expect(t).toContain(LIMITATION_TEXT.js_fallback);
    expect(t).toContain(LIMITATION_TEXT.sitemap_unavailable);
    expect(t).toContain(LIMITATION_TEXT.field_data_unavailable);
    expect(t).toContain('We checked only the homepage');
  });

  it('states how the page was loaded', async () => {
    expect(await text()).toContain('in a web browser with JavaScript');
    expect(await text({ scan: { ...scan, loadedWith: 'direct-fallback' } })).toContain('without JavaScript');
  });

  it('cover uses client business name, else domain; shows branding only when provided', async () => {
    const plain = await text();
    expect(plain).toContain('Website Review for example.com');
    expect(plain).not.toContain('Prepared by');
    expect(plain).not.toContain('SiteLens');

    const named = await text({
      draft: { ...defaultDraft(scan), clientBusinessName: 'Smith & Sons' },
      branding: {
        region: 'UK',
        name: 'Harbour Web Studio',
        contact: 'hello@harbourweb.co.uk',
      },
    });
    expect(named).toContain('Website Review for Smith & Sons');
    expect(named).toContain('Prepared by');
    expect(named).toContain('Harbour Web Studio');
    expect(named).toContain('hello@harbourweb.co.uk');
  });

  it('shows next steps with the contact details, and omits the section without next steps', async () => {
    const branding: Branding = {
      region: 'UK',
      name: 'Harbour Web Studio',
      contact: 'hello@harbourweb.co.uk',
    };
    const without = await text({ branding });
    expect(without).not.toContain('Recommended next steps');
    const t = await text({
      branding,
      draft: {
        ...defaultDraft(scan),
        nextSteps: 'Fix the secure connection first.',
      },
    });
    expect(t).toContain('Recommended next steps');
    expect(t).toContain('Fix the secure connection first.');
  });

  it('evidence values appear exactly as in the scan (e.g. title length 25)', async () => {
    const t = await text();
    expect(t).toContain('Smith & Sons Plumbing Ltd');
    expect(t).toMatch(/Length\s25\b/);
  });

  it('prints the page number and the date in the footer of every page', async () => {
    const { text: t } = await renderPdf(<ReportDocument {...props()} />);
    const total = Number(t.match(/Page 1 of (\d+)/)?.[1]);
    expect(total).toBeGreaterThan(1);
    expect(t).toContain(`Page ${total} of ${total}`);
    expect(t.match(/15 November 2026/g)!.length).toBeGreaterThanOrEqual(total);
  });

  it('uses A4 for UK and LETTER for US', async () => {
    const a4 = await renderPdf(<ReportDocument {...props()} />);
    expect(a4.raw).toMatch(/\/MediaBox \[0 0 595\.2\d* 841\.8\d*\]/);
    const letter = await renderPdf(<ReportDocument {...props({ branding: { region: 'US' } })} />);
    expect(letter.raw).toMatch(/\/MediaBox \[0 0 612 792\]/);
    expect(letter.text).toContain('November 15, 2026');
  });
});

import { Children } from 'react';
import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import {
  RATING_LABEL,
  evidenceLabel,
  formatCls,
  formatEvidenceValue,
  formatMs,
  formatSeconds,
} from '@/components/dashboard/format';
import { CHECK_COPY } from '@/lib/content/checks';
import { LIMITATION_TEXT } from '@/lib/content/limitations';
import type { CwvRating, FieldMetric, PageSpeedOutcome, PageSpeedResult } from '@/lib/performance';
import { reportSections, type ReportDraft } from '@/lib/report/draft';
import { hasUnprintableText } from '@/lib/report/charset';
import { formatDate, pageSize } from '@/lib/report/region';
import { buildSummary } from '@/lib/report/summary';
import type { Branding } from '@/lib/storage';
import type { Finding, LimitationCode, ScanResult } from '@/lib/types';

// The client PDF. The live preview and the export render this same component with the same props.
// All text is plain language for a business owner. Every value comes from the scan or from Google.

// Do not split words with a hyphen. An inserted hyphen would change how evidence looks.
Font.registerHyphenationCallback((word) => [word]);

export interface ReportDocumentProps {
  scan: ScanResult;
  pagespeed: PageSpeedOutcome | undefined;
  draft: ReportDraft;
  branding: Branding;
}

const C = {
  ink: '#1d232b',
  body: '#3b424c',
  muted: '#68707c',
  rule: '#d8dce2',
  panel: '#f3f5f7',
  critical: '#b42419',
  warning: '#9a5a06',
  opportunity: '#1f5fae',
  passed: '#1e7448',
  observation: '#56606d',
};

const SEVERITY: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical', color: C.critical },
  warning: { label: 'Warning', color: C.warning },
  opportunity: { label: 'Opportunity', color: C.opportunity },
};

const RATING_COLOR: Record<CwvRating, string> = {
  good: C.passed,
  'needs-improvement': C.warning,
  poor: C.critical,
};

const s = StyleSheet.create({
  page: {
    paddingTop: 60,
    paddingBottom: 72,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.55,
    color: C.body,
  },
  footer: {
    position: 'absolute',
    left: 56,
    right: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.75,
    borderTopColor: C.rule,
    paddingTop: 8,
    fontSize: 8,
    color: C.muted,
  },
  // Cover
  cover: {
    flexGrow: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  logo: { maxHeight: 48, maxWidth: 150, marginRight: 14, objectFit: 'contain' },
  brandName: { fontWeight: 'bold', fontSize: 11, color: C.ink },
  brandContact: { fontSize: 9, color: C.muted },
  coverRule: { width: 44, height: 3, backgroundColor: C.ink, marginBottom: 22 },
  coverTitle: { fontWeight: 'bold', lineHeight: 1.18, color: C.ink },
  coverDomain: { marginTop: 14, fontSize: 13, color: C.muted },
  facts: { borderTopWidth: 0.75, borderTopColor: C.rule, paddingTop: 14 },
  factRow: { flexDirection: 'row', marginBottom: 6 },
  factLabel: { width: 110, fontSize: 9, color: C.muted },
  factValue: { flex: 1, fontSize: 10, color: C.ink },
  // Sections
  section: { marginTop: 30 },
  sectionFirst: { marginTop: 0 },
  h2: {
    fontWeight: 'bold',
    fontSize: 17,
    lineHeight: 1.25,
    color: C.ink,
    marginBottom: 12,
  },
  h3: { fontWeight: 'bold', fontSize: 11, color: C.ink, marginBottom: 2 },
  intro: { color: C.muted, marginBottom: 14, maxWidth: 440 },
  lead: { fontSize: 11.5, lineHeight: 1.6, color: C.ink, maxWidth: 450 },
  paragraph: { maxWidth: 450, marginBottom: 6 },
  selection: { marginTop: 10, maxWidth: 450, color: C.ink, fontWeight: 'bold' },
  // Findings
  // A left border, not a separate bar view. A bar view left an empty stub at the foot of a page.
  finding: { marginBottom: 22, borderLeftWidth: 3, paddingLeft: 14 },
  tagRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  severity: { fontWeight: 'bold', fontSize: 8.5, marginRight: 10 },
  heuristic: { fontSize: 8.5, color: C.muted },
  findingTitle: {
    fontWeight: 'bold',
    fontSize: 12.5,
    lineHeight: 1.35,
    color: C.ink,
    marginBottom: 8,
  },
  partLabel: {
    fontWeight: 'bold',
    fontSize: 9,
    color: C.ink,
    marginTop: 8,
    marginBottom: 2,
  },
  evidence: {
    backgroundColor: C.panel,
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  evidenceRow: { flexDirection: 'row', paddingVertical: 1.5 },
  evidenceKey: { width: 104, fontSize: 9, color: C.muted, paddingRight: 8 },
  evidenceValue: { flex: 1, fontSize: 9.5, color: C.ink },
  // Performance
  block: { marginBottom: 20 },
  note: { fontSize: 9, color: C.muted, marginBottom: 10 },
  scores: {
    flexDirection: 'row',
    borderTopWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: C.rule,
    marginBottom: 10,
  },
  score: { flex: 1, paddingVertical: 9 },
  scoreLabel: { fontSize: 8.5, color: C.muted },
  scoreValue: {
    fontWeight: 'bold',
    fontSize: 22,
    lineHeight: 1.2,
    color: C.ink,
  },
  row: { flexDirection: 'row', paddingVertical: 2.5 },
  rowLabel: { flex: 1 },
  rowValue: { width: 70, textAlign: 'right', color: C.ink },
  rowRating: {
    width: 110,
    textAlign: 'right',
    fontWeight: 'bold',
    fontSize: 9,
  },
  // Lists
  listItem: { flexDirection: 'row', marginBottom: 5, maxWidth: 450 },
  dot: { width: 5, height: 5, marginTop: 5, marginRight: 10, borderRadius: 1 },
  dash: { width: 12, color: C.muted },
  listText: { flex: 1 },
  unable: { marginBottom: 10, maxWidth: 450 },
  unableTitle: { fontWeight: 'bold', color: C.ink },
});

const SELECTION_NOTE = 'This report presents a selection of findings from the review.';

/** Inserts a line break into a word that is too long for the column. The characters do not change. */
function breakLongWords(text: string, max: number): string {
  return text
    .split(' ')
    .map((word) => {
      // Array.from keeps each emoji and each other surrogate pair as one character.
      const chars = Array.from(word);
      if (chars.length <= max) return word;
      const parts: string[] = [];
      for (let i = 0; i < chars.length; i += max) parts.push(chars.slice(i, i + max).join(''));
      return parts.join('\n');
    })
    .join(' ');
}

function domainOf(scan: ScanResult): string {
  try {
    return new URL(scan.finalUrl).hostname.replace(/^www\./, '');
  } catch {
    return scan.finalUrl;
  }
}

// Points from the top of the page to the footer. With a line height on the page, react-pdf 4.9
// puts a footer with "bottom" off the page. A "top" value works.
const FOOTER_TOP: Record<'A4' | 'LETTER', number> = {
  A4: 841.89 - 50,
  LETTER: 792 - 50,
};

function Footer({ date, size }: { date: string; size: 'A4' | 'LETTER' }) {
  return (
    <View style={[s.footer, { top: FOOTER_TOP[size] }]} fixed>
      <Text>{date}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

function Cover({ title, domain, date, branding }: { title: string; domain: string; date: string; branding: Branding }) {
  const name = branding.name?.trim();
  const contact = branding.contact?.trim();
  // A long domain or name gets a smaller title, so that it fits on one line.
  const longest = Math.max(...title.split(' ').map((w) => w.length));
  const titleSize = longest > 22 ? 24 : 30;
  return (
    <View style={s.cover}>
      <View style={s.brand}>
        {/* A react-pdf Image has no alt prop. The rule is for HTML img elements. */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        {branding.logoDataUrl && <Image src={branding.logoDataUrl} style={s.logo} />}
        {(name || contact) && (
          <View>
            {name && <Text style={s.brandName}>{breakLongWords(name, 40)}</Text>}
            {contact && <Text style={s.brandContact}>{breakLongWords(contact, 50)}</Text>}
          </View>
        )}
      </View>
      <View>
        <View style={s.coverRule} />
        <Text style={[s.coverTitle, { fontSize: titleSize }]}>{breakLongWords(title, titleSize === 30 ? 26 : 34)}</Text>
        <Text style={s.coverDomain}>{breakLongWords(domain, 50)}</Text>
      </View>
      <View style={s.facts}>
        <View style={s.factRow}>
          <Text style={s.factLabel}>Website</Text>
          <Text style={s.factValue}>{breakLongWords(domain, 60)}</Text>
        </View>
        <View style={s.factRow}>
          <Text style={s.factLabel}>Date of review</Text>
          <Text style={s.factValue}>{date}</Text>
        </View>
        {(name || contact) && (
          <View style={s.factRow}>
            <Text style={s.factLabel}>Prepared by</Text>
            <Text style={s.factValue}>{breakLongWords([name, contact].filter(Boolean).join(', '), 50)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// The heading and its first `keep` children do not split over two pages, so a heading never
// sits alone at the bottom of a page. (minPresenceAhead did not do this in react-pdf 4.9.)
function Section({
  title,
  first,
  keep = 1,
  children,
}: {
  title: string;
  first?: boolean;
  keep?: number;
  children: React.ReactNode;
}) {
  const items = Children.toArray(children);
  return (
    <View style={first ? s.sectionFirst : s.section}>
      <View wrap={false}>
        <Text style={s.h2}>{title}</Text>
        {items.slice(0, keep)}
      </View>
      {items.slice(keep)}
    </View>
  );
}

function Evidence({ finding }: { finding: Finding }) {
  const entries = Object.entries(finding.evidence);
  if (entries.length === 0) return null;
  return (
    <View style={s.evidence}>
      {entries.map(([key, value]) => (
        <View key={key} style={s.evidenceRow} wrap={false}>
          <Text style={s.evidenceKey}>{evidenceLabel(key)}</Text>
          <Text style={s.evidenceValue}>{breakLongWords(formatEvidenceValue(value), 44)}</Text>
        </View>
      ))}
    </View>
  );
}

// A short labelled paragraph. It does not split over two pages.
function Part({ label, children }: { label: string; children: string }) {
  return (
    <View wrap={false}>
      <Text style={s.partLabel}>{label}</Text>
      <Text>{children}</Text>
    </View>
  );
}

function FindingBlock({ finding }: { finding: Finding }) {
  const copy = CHECK_COPY[finding.checkId];
  const sev = SEVERITY[finding.severity] ?? {
    label: 'Observation',
    color: C.observation,
  };
  const isFail = finding.status === 'fail';
  const evidenceCount = Object.keys(finding.evidence).length;
  const header = (
    <>
      <View style={s.tagRow}>
        {isFail && <Text style={[s.severity, { color: sev.color }]}>{sev.label}</Text>}
        {finding.confidence === 'heuristic' && <Text style={s.heuristic}>Observation from page code</Text>}
      </View>
      <Text style={s.findingTitle}>{copy?.clientTitle ?? finding.checkId}</Text>
    </>
  );
  const parts = [
    evidenceCount > 0 && (
      <View key="evidence" wrap={evidenceCount > 6}>
        <Text style={s.partLabel}>What we found</Text>
        <Evidence finding={finding} />
      </View>
    ),
    copy && (
      <Part key="why" label="Why it matters">
        {copy.whyItMatters}
      </Part>
    ),
    copy && isFail && (
      <Part key="fix" label="Recommended fix">
        {copy.howToFix}
      </Part>
    ),
  ].filter(Boolean);
  const groupFirst = evidenceCount <= 6;
  return (
    <View style={[s.finding, { borderLeftColor: isFail ? sev.color : C.observation }]}>
      {/* The label, the title, and the first part stay on one page. Long evidence can split. */}
      <View wrap={false}>
        {header}
        {groupFirst && parts[0]}
      </View>
      {groupFirst ? parts.slice(1) : parts}
    </View>
  );
}

function LabBlock({ data }: { data: PageSpeedResult }) {
  const { scores, metrics } = data.lab;
  const scoreItems: [string, number][] = [
    ['Performance', scores.performance],
    ['Accessibility', scores.accessibility],
    ['Best practices', scores.bestPractices],
    ['SEO', scores.seo],
  ];
  const metricItems: [string, string][] = [
    ['Time to show the main content (LCP)', formatSeconds(metrics.lcpMs)],
    ['Time to show the first content (FCP)', formatSeconds(metrics.fcpMs)],
    ['How fast the page fills in (Speed Index)', formatSeconds(metrics.speedIndexMs)],
    ['Time the page is blocked while it loads (TBT)', formatMs(metrics.tbtMs)],
    ['Movement of the page as it loads (CLS)', formatCls(metrics.cls)],
  ];
  return (
    <View style={s.block} wrap={false}>
      <Text style={s.h3}>Google Lighthouse (lab test, mobile)</Text>
      <Text style={s.note}>A simulated test by Google on a mobile device. Scores are out of 100.</Text>
      <View style={s.scores}>
        {scoreItems.map(([label, value]) => (
          <View key={label} style={s.score}>
            <Text style={s.scoreLabel}>{label}</Text>
            <Text style={s.scoreValue}>{value}</Text>
          </View>
        ))}
      </View>
      {metricItems.map(([label, value]) => (
        <View key={label} style={s.row}>
          <Text style={s.rowLabel}>{label}</Text>
          <Text style={s.rowValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function FieldRow({ label, metric, format }: { label: string; metric?: FieldMetric; format: (v: number) => string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{metric ? format(metric.p75) : 'Not available'}</Text>
      <Text style={[s.rowRating, { color: metric ? RATING_COLOR[metric.rating] : C.muted }]}>
        {metric ? RATING_LABEL[metric.rating] : ''}
      </Text>
    </View>
  );
}

function FieldBlock({ data }: { data: PageSpeedResult }) {
  const field = data.field;
  return (
    <View style={s.block} wrap={false}>
      <Text style={s.h3}>Real-user data from Google</Text>
      {!field ? (
        <Text>{LIMITATION_TEXT.field_data_unavailable}</Text>
      ) : (
        <>
          <Text style={s.note}>
            {`Real Chrome users over the last 28 days. Each value is the 75th percentile: 3 in 4 visits were this fast or faster. Data for: ${
              field.scope === 'url' ? 'this page' : 'the whole website'
            }.`}
          </Text>
          <FieldRow label="Time to show the main content (LCP)" metric={field.lcp} format={formatSeconds} />
          <FieldRow label="Response to taps and clicks (INP)" metric={field.inp} format={formatMs} />
          <FieldRow label="Movement of the page as it loads (CLS)" metric={field.cls} format={formatCls} />
        </>
      )}
    </View>
  );
}

function Dash({ children }: { children: string }) {
  return (
    <View style={s.listItem} wrap={false}>
      <Text style={s.dash}>-</Text>
      <Text style={s.listText}>{children}</Text>
    </View>
  );
}

function scopeStatements(scan: ScanResult, date: string): string[] {
  return [
    'We checked only the homepage, the robots.txt file (rules for search engines), and the sitemap (a list of pages for search engines). We did not check other pages.',
    `The results show the website on ${date}. The website can change after this date.`,
    scan.loadedWith === 'firecrawl'
      ? 'We loaded the page in a web browser with JavaScript, as a visitor sees it.'
      : 'We read the code of the page without JavaScript, because the page could not be loaded in a web browser.',
    'The lab performance test is a simulation by Google. Real-user data comes from Chrome users, when Google has enough data.',
    'The items about visitors, enquiries, and AI search are observations from the page code. They are not results from user testing or analytics, and they do not guarantee an outcome.',
    'We did not have access to the analytics, the Google Search Console account, or the business data of the website.',
  ];
}

export function ReportDocument({ scan, pagespeed, draft, branding }: ReportDocumentProps) {
  const region = branding.region;
  const size = pageSize(region);
  const date = formatDate(scan.scannedAt, region);
  const domain = domainOf(scan);
  const clientName = draft.clientBusinessName?.trim();
  const title = `Website Review for ${clientName || domain}`;
  const sections = reportSections(scan, pagespeed, draft);
  const summary = buildSummary(scan, pagespeed, draft, region);
  const unprintable = hasUnprintableText({ scan, pagespeed, draft, branding });
  const nextSteps = draft.nextSteps?.trim();
  const contact = [branding.name?.trim(), branding.contact?.trim()].filter(Boolean).join(', ');

  // The dashboard also lists this limitation when the performance test gave no result.
  const limitations: LimitationCode[] = [...sections.limitations];
  if (draft.includePerformance && !pagespeed && !limitations.includes('performance_unavailable')) {
    limitations.push('performance_unavailable');
  }

  return (
    <Document title={title} author={branding.name?.trim() || undefined} creator="" producer="">
      <Page size={size} style={s.page}>
        <Cover title={title} domain={domain} date={date} branding={branding} />
        <Footer date={date} size={size} />
      </Page>

      <Page size={size} style={s.page} wrap>
        <Footer date={date} size={size} />
        <Section title="Summary" first keep={2}>
          <Text style={s.lead}>{summary}</Text>
          {sections.selectionNote && <Text style={s.selection}>{SELECTION_NOTE}</Text>}
        </Section>

        {sections.findings.length > 0 && (
          <Section title="Findings" keep={2}>
            <Text style={s.intro}>The most important findings come first.</Text>
            {sections.findings.map((f) => (
              <FindingBlock key={f.checkId} finding={f} />
            ))}
          </Section>
        )}

        {draft.includePerformance && (
          <Section title="Performance">
            {pagespeed?.ok
              ? [<LabBlock key="lab" data={pagespeed.data} />, <FieldBlock key="field" data={pagespeed.data} />]
              : [<Text key="none">{LIMITATION_TEXT.performance_unavailable}</Text>]}
          </Section>
        )}

        {sections.passed.length > 0 && (
          <Section title="What is working well">
            {sections.passed.map((f) => (
              <View key={f.checkId} style={s.listItem} wrap={false}>
                <View style={[s.dot, { backgroundColor: C.passed }]} />
                <Text style={s.listText}>{CHECK_COPY[f.checkId]?.title ?? f.checkId}</Text>
              </View>
            ))}
          </Section>
        )}

        {sections.observations.length > 0 && (
          <Section title="Observations" keep={2}>
            <Text style={s.intro}>These are facts about the website. They are not problems.</Text>
            {sections.observations.map((f) => (
              <FindingBlock key={f.checkId} finding={f} />
            ))}
          </Section>
        )}

        {sections.couldNotCheck.length > 0 && (
          <Section title="What we could not check" keep={2}>
            <Text style={s.intro}>
              We could not check these items automatically. They do not count as problems or as passes.
            </Text>
            {sections.couldNotCheck.map((f) => (
              <View key={f.checkId} style={s.unable} wrap={false}>
                <Text style={s.unableTitle}>{CHECK_COPY[f.checkId]?.title ?? f.checkId}</Text>
                {f.unableReason && <Text>{f.unableReason}</Text>}
              </View>
            ))}
          </Section>
        )}

        {nextSteps && (
          <Section title="Recommended next steps">
            {nextSteps.split(/\n+/).map((p, i) => (
              <Text key={i} style={s.paragraph}>
                {breakLongWords(p, 60)}
              </Text>
            ))}
            {contact && (
              <View style={[s.factRow, { marginTop: 10 }]}>
                <Text style={s.factLabel}>Contact</Text>
                <Text style={s.factValue}>{breakLongWords(contact, 50)}</Text>
              </View>
            )}
          </Section>
        )}

        <Section title="Scope and limitations">
          {scopeStatements(scan, date).map((line) => (
            <Dash key={line}>{line}</Dash>
          ))}
          {limitations.map((code) => (
            <Dash key={code}>{LIMITATION_TEXT[code]}</Dash>
          ))}
          {sections.selectionNote && <Dash>{SELECTION_NOTE}</Dash>}
          {unprintable && <Dash>Some characters could not be shown in this PDF font.</Dash>}
        </Section>
      </Page>
    </Document>
  );
}

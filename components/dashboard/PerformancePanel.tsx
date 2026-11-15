'use client';

import { useId } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ToneBadge } from '@/components/dashboard/ToneBadge';
import {
  RATING_LABEL,
  RATING_TONE,
  formatCls,
  formatDateTime,
  formatMs,
  formatSeconds,
} from '@/components/dashboard/format';
import { LIMITATION_TEXT } from '@/lib/content/limitations';
import type { FieldMetric, PageSpeedOutcome, PageSpeedResult } from '@/lib/performance';

export interface PerformancePanelProps {
  outcome: PageSpeedOutcome | undefined;
  loading: boolean;
  includePerformance: boolean;
  onIncludeChange: (include: boolean) => void;
}

const NO_FIELD_DATA = 'Google does not have enough real-user data for this site.';

function Unavailable({ reason }: { reason: string }) {
  return (
    <div className="rounded-md border border-dashed border-sev-unable-border bg-sev-unable-bg px-4 py-3">
      <h3 className="text-sm font-semibold text-sev-unable">Performance data unavailable</h3>
      <p className="mt-1 text-sm text-foreground">{reason}</p>
    </div>
  );
}

function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground" role="status">
        Google is testing the page. This can take up to one minute.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-28" />
    </div>
  );
}

function LabBlock({ data }: { data: PageSpeedResult }) {
  const { scores, metrics } = data.lab;
  const scoreItems = [
    ['Performance', scores.performance],
    ['Accessibility', scores.accessibility],
    ['Best practices', scores.bestPractices],
    ['SEO', scores.seo],
  ] as const;
  const metricItems = [
    ['Largest Contentful Paint', formatSeconds(metrics.lcpMs)],
    ['First Contentful Paint', formatSeconds(metrics.fcpMs)],
    ['Speed Index', formatSeconds(metrics.speedIndexMs)],
    ['Total Blocking Time', formatMs(metrics.tbtMs)],
    ['Cumulative Layout Shift', formatCls(metrics.cls)],
  ] as const;

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">Google Lighthouse (lab, mobile)</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        A simulated test on a mobile device. Tested {formatDateTime(data.fetchedAt)}.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-4">
        {scoreItems.map(([label, value]) => (
          <div key={label} className="flex flex-col-reverse bg-card px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
              <span>{value}</span>
              <span className="sr-only"> out of 100</span>
            </dd>
          </div>
        ))}
      </dl>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
        {metricItems.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium text-foreground tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function FieldRow({ label, metric, format }: { label: string; metric?: FieldMetric; format: (v: number) => string }) {
  return (
    <div className="contents">
      <dt className="self-center text-muted-foreground">{label}</dt>
      <dd className="self-center text-right font-medium text-foreground tabular-nums">
        {metric ? format(metric.p75) : <span className="font-normal text-muted-foreground">Not available</span>}
      </dd>
      <dd className="flex justify-end">
        {metric && <ToneBadge tone={RATING_TONE[metric.rating]}>{RATING_LABEL[metric.rating]}</ToneBadge>}
      </dd>
    </div>
  );
}

function FieldBlock({ data }: { data: PageSpeedResult }) {
  const field = data.field;
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">Real-user data (Google)</h3>
      {!field ? (
        <p className="mt-2 text-sm text-foreground">{NO_FIELD_DATA}</p>
      ) : (
        <>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Chrome users over the last 28 days, 75th percentile. Data for:{' '}
            <span className="font-medium text-foreground">{field.scope === 'url' ? 'This page' : 'Whole site'}</span>
          </p>
          <dl className="mt-3 grid grid-cols-[1fr_auto_minmax(9rem,auto)] gap-x-4 gap-y-2 text-sm">
            <FieldRow label="Largest Contentful Paint" metric={field.lcp} format={formatSeconds} />
            <FieldRow label="Interaction to Next Paint" metric={field.inp} format={formatMs} />
            <FieldRow label="Cumulative Layout Shift" metric={field.cls} format={formatCls} />
          </dl>
        </>
      )}
    </div>
  );
}

/** Google values exactly as returned. Only the display format changes. */
export function PerformancePanel({ outcome, loading, includePerformance, onIncludeChange }: PerformancePanelProps) {
  const headingId = useId();
  const switchLabelId = useId();

  let body: React.ReactNode;
  if (loading) body = <Loading />;
  else if (!outcome) body = <Unavailable reason={LIMITATION_TEXT.performance_unavailable} />;
  else if (!outcome.ok) body = <Unavailable reason={outcome.unavailable} />;
  else
    body = (
      <div className="flex flex-col gap-6">
        <LabBlock data={outcome.data} />
        <div className="border-t pt-5">
          <FieldBlock data={outcome.data} />
        </div>
      </div>
    );

  return (
    <section aria-labelledby={headingId} className="rounded-lg border bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id={headingId} className="text-base font-semibold text-foreground">
          Performance
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <span id={switchLabelId} className="text-xs text-muted-foreground">
            Include performance in client report
          </span>
          <Switch
            aria-labelledby={switchLabelId}
            checked={includePerformance}
            onCheckedChange={(checked) => onIncludeChange(checked)}
          />
        </div>
      </div>
      {body}
    </section>
  );
}

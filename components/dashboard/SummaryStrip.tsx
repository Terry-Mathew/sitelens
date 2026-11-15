import type { Finding } from '@/lib/types';
import { cn } from '@/lib/utils';

const ITEMS = [
  { label: 'Critical', bar: 'bg-sev-critical', count: (f: Finding) => f.status === 'fail' && f.severity === 'critical' },
  { label: 'Warning', bar: 'bg-sev-warning', count: (f: Finding) => f.status === 'fail' && f.severity === 'warning' },
  { label: 'Opportunity', bar: 'bg-sev-opportunity', count: (f: Finding) => f.status === 'fail' && f.severity === 'opportunity' },
  { label: 'Passed', bar: 'bg-sev-passed', count: (f: Finding) => f.status === 'pass' },
] as const;

/** Counts of results by severity. There is no overall score. Observations are not counted. */
export function SummaryStrip({ findings }: { findings: Finding[] }) {
  return (
    <section aria-label="Summary">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
        {ITEMS.map((item) => (
          <div key={item.label} className="relative flex flex-col-reverse gap-0.5 bg-card py-3 pr-4 pl-5">
            <span aria-hidden="true" className={cn('absolute top-3 bottom-3 left-0 w-1 rounded-r', item.bar)} />
            <dt className="text-sm text-muted-foreground">{item.label}</dt>
            <dd className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
              {findings.filter(item.count).length}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

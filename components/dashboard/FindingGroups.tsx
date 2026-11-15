import { FindingCard } from '@/components/dashboard/FindingCard';
import { CATEGORY_LABEL, CATEGORY_ORDER } from '@/components/dashboard/format';
import { bySeverity } from '@/lib/report/draft';
import type { Finding } from '@/lib/types';

export interface FindingListProps {
  findings: Finding[];
  includedIds: string[];
  onToggle: (checkId: string, include: boolean) => void;
}

/** Failed checks, grouped by category and sorted by severity. */
export function FindingGroups({ findings, includedIds, onToggle }: FindingListProps) {
  const failed = findings.filter((f) => f.status === 'fail');
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: bySeverity(failed.filter((f) => f.category === category)),
  })).filter((g) => g.items.length > 0);

  return (
    <section aria-labelledby="findings-heading" className="flex flex-col gap-6">
      <h2 id="findings-heading" className="text-lg font-semibold text-foreground">
        Findings
      </h2>
      {groups.length === 0 && (
        <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          No check failed. Look at the lists below for the checks that SiteLens could not do.
        </p>
      )}
      {groups.map(({ category, items }) => (
        <div key={category} className="flex flex-col gap-3">
          <h3 className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
            {CATEGORY_LABEL[category]}
            <span className="font-normal text-muted-foreground tabular-nums">{items.length}</span>
          </h3>
          {items.map((f) => (
            <FindingCard
              key={f.checkId}
              finding={f}
              included={includedIds.includes(f.checkId)}
              onToggle={onToggle}
            />
          ))}
        </div>
      ))}
    </section>
  );
}

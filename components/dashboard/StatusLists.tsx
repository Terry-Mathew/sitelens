import { FindingCard } from '@/components/dashboard/FindingCard';
import type { FindingListProps } from '@/components/dashboard/FindingGroups';
import { CATEGORY_LABEL } from '@/components/dashboard/format';
import { CHECK_COPY } from '@/lib/content/checks';
import type { Finding } from '@/lib/types';

function CardList({ id, title, note, items, includedIds, onToggle }: FindingListProps & {
  id: string;
  title: string;
  note: string;
  items: Finding[];
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div>
        <h2 id={id} className="flex items-baseline gap-2 text-lg font-semibold text-foreground">
          {title}
          <span className="text-sm font-normal text-muted-foreground tabular-nums">{items.length}</span>
        </h2>
        <p className="mt-0.5 max-w-[68ch] text-sm text-muted-foreground">{note}</p>
      </div>
      {items.map((f) => (
        <FindingCard key={f.checkId} finding={f} included={includedIds.includes(f.checkId)} onToggle={onToggle} />
      ))}
    </section>
  );
}

/** Observations, passed checks, checks that could not run, and checks that do not apply. */
export function StatusLists({ findings, includedIds, onToggle }: FindingListProps) {
  const by = (status: Finding['status']) => findings.filter((f) => f.status === status);
  const notApplicable = by('not_applicable');
  const shared = { findings, includedIds, onToggle };

  return (
    <div className="flex flex-col gap-10">
      <CardList
        {...shared}
        id="observations-heading"
        title="Observations"
        note="Neutral facts about the site. They are not problems and are not counted. They are not in the client report unless you include them."
        items={by('observation')}
      />
      <CardList
        {...shared}
        id="passed-heading"
        title="Passed"
        note="Checks that the homepage passed."
        items={by('pass')}
      />
      <CardList
        {...shared}
        id="unable-heading"
        title="Could not check"
        note="SiteLens could not do these checks. The client report always shows them, so missing data does not look like a pass."
        items={by('unable_to_check')}
      />
      {notApplicable.length > 0 && (
        <details className="group rounded-lg border bg-card">
          <summary className="flex cursor-pointer items-baseline gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Not applicable
            <span className="font-normal text-muted-foreground tabular-nums">{notApplicable.length}</span>
            <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">Show</span>
            <span className="ml-auto hidden text-xs font-normal text-muted-foreground group-open:inline">Hide</span>
          </summary>
          <ul className="flex flex-col gap-1 border-t px-4 py-3 text-sm">
            {notApplicable.map((f) => (
              <li key={f.checkId} className="flex flex-wrap justify-between gap-x-4">
                <span className="text-foreground">{CHECK_COPY[f.checkId]?.title ?? f.checkId}</span>
                <span className="text-muted-foreground">{CATEGORY_LABEL[f.category]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

'use client';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ToneBadge } from '@/components/dashboard/ToneBadge';
import { SOURCE_LABEL, evidenceLabel, findingTone, formatEvidenceValue } from '@/components/dashboard/format';
import { CHECK_COPY } from '@/lib/content/checks';
import { isToggleable } from '@/lib/report/draft';
import type { Finding } from '@/lib/types';
import { cn } from '@/lib/utils';

const HEURISTIC_NOTE = 'based on page code patterns, not user testing.';

// Plain text, so screen readers read the full explanation. The title gives the same text on hover.
function HeuristicTag() {
  return (
    <span
      role="note"
      title={`Heuristic: ${HEURISTIC_NOTE}`}
      className="inline-flex h-6 items-center rounded-md border border-border px-2 text-xs font-medium text-muted-foreground"
    >
      Heuristic<span className="sr-only">: {HEURISTIC_NOTE}</span>
    </span>
  );
}

function Evidence({ finding }: { finding: Finding }) {
  const entries = Object.entries(finding.evidence);
  return (
    <div className="rounded-md bg-muted/70 px-3 py-2.5">
      {entries.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(7rem,max-content)_1fr]">
          {entries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">{evidenceLabel(key)}</dt>
              <dd className="mb-1 break-words text-foreground tabular-nums sm:mb-0">{formatEvidenceValue(value)}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className={cn('text-xs text-muted-foreground', entries.length > 0 && 'mt-2')}>
        Source: {SOURCE_LABEL[finding.source]}
      </p>
    </div>
  );
}

export interface FindingCardProps {
  finding: Finding;
  included: boolean;
  onToggle: (checkId: string, include: boolean) => void;
}

/** One finding in the technical view. Evidence is read-only. Only the include choice can change. */
export function FindingCard({ finding, included, onToggle }: FindingCardProps) {
  const copy = CHECK_COPY[finding.checkId];
  const title = copy?.title ?? finding.checkId;
  const { tone, label } = findingTone(finding);
  const toggleable = isToggleable(finding);
  const excluded = toggleable && !included;
  const showWhy = finding.status === 'fail' || finding.status === 'observation';
  const showFix = finding.status === 'fail';

  // An excluded card keeps full text contrast. A dashed border, a muted surface, and a label show the state.
  return (
    <article
      data-excluded={excluded || undefined}
      className={cn('rounded-lg border bg-card p-4 sm:p-5', excluded && 'border-dashed border-foreground/25 bg-muted/60')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ToneBadge tone={tone}>{label}</ToneBadge>
        {finding.confidence === 'heuristic' && <HeuristicTag />}
        <div className="ml-auto flex items-center gap-2">
          {toggleable && excluded && (
            <>
              <span className="text-xs font-medium text-foreground">Not in client report</span>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Add to report: ${title}`}
                onClick={() => onToggle(finding.checkId, true)}
              >
                Add to report
              </Button>
            </>
          )}
          {toggleable && !excluded && (
            <>
              <span aria-hidden="true" className="text-xs text-muted-foreground">
                Include in client report
              </span>
              <Switch
                aria-label={`Include in client report: ${title}`}
                checked={included}
                onCheckedChange={(checked) => onToggle(finding.checkId, checked)}
              />
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <h3 className="text-[0.95rem] leading-snug font-semibold text-foreground">{title}</h3>
        {finding.status === 'unable_to_check' && finding.unableReason && (
          <p className="text-sm text-foreground">{finding.unableReason}</p>
        )}
        {finding.status !== 'unable_to_check' && <Evidence finding={finding} />}
        {copy && showWhy && (
          <div className="max-w-[68ch] text-sm leading-relaxed">
            <h4 className="font-medium text-foreground">Why it matters</h4>
            <p className="text-muted-foreground">{copy.whyItMatters}</p>
          </div>
        )}
        {copy && showFix && (
          <div className="max-w-[68ch] text-sm leading-relaxed">
            <h4 className="font-medium text-foreground">How to fix</h4>
            <p className="text-muted-foreground">{copy.howToFix}</p>
          </div>
        )}
      </div>
    </article>
  );
}

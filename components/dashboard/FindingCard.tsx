'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ToneBadge } from '@/components/dashboard/ToneBadge';
import { SOURCE_LABEL, evidenceLabel, findingTone, formatEvidenceValue } from '@/components/dashboard/format';
import { CHECK_COPY } from '@/lib/content/checks';
import { isToggleable } from '@/lib/report/draft';
import type { Finding } from '@/lib/types';
import { cn } from '@/lib/utils';

const HEURISTIC_NOTE = 'Based on page code patterns, not user testing.';

function HeuristicTag() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            aria-label={`Heuristic. ${HEURISTIC_NOTE}`}
            className="inline-flex h-6 cursor-help items-center rounded-md border border-border px-2 text-xs font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <span aria-hidden="true">Heuristic</span>
      </TooltipTrigger>
      <TooltipContent>{HEURISTIC_NOTE}</TooltipContent>
    </Tooltip>
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
  const labelId = useId();
  const copy = CHECK_COPY[finding.checkId];
  const { tone, label } = findingTone(finding);
  const toggleable = isToggleable(finding);
  const excluded = toggleable && !included;
  const showWhy = finding.status === 'fail' || finding.status === 'observation';
  const showFix = finding.status === 'fail';

  return (
    <article
      data-excluded={excluded || undefined}
      className={cn('rounded-lg border bg-card p-4 sm:p-5', excluded && 'border-dashed bg-transparent')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ToneBadge tone={tone}>{label}</ToneBadge>
        {finding.confidence === 'heuristic' && <HeuristicTag />}
        <div className="ml-auto flex items-center gap-2">
          {toggleable && excluded && (
            <>
              <span className="text-xs text-muted-foreground">Not in client report</span>
              <Button variant="outline" size="sm" onClick={() => onToggle(finding.checkId, true)}>
                Restore
              </Button>
            </>
          )}
          {toggleable && !excluded && (
            <>
              <span id={labelId} className="text-xs text-muted-foreground">
                Include in client report
              </span>
              <Switch
                aria-labelledby={labelId}
                checked={included}
                onCheckedChange={(checked) => onToggle(finding.checkId, checked)}
              />
            </>
          )}
        </div>
      </div>

      <div className={cn('mt-3 flex flex-col gap-3', excluded && 'opacity-60')}>
        <h3 className="text-[0.95rem] leading-snug font-semibold text-foreground">{copy?.title ?? finding.checkId}</h3>
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

import { cn } from '@/lib/utils';
import { TONE_CLASS, type Tone } from '@/components/dashboard/format';

/** A small status label. The text carries the meaning, so colour is never the only signal. */
export function ToneBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center rounded-md border px-2 text-xs font-medium whitespace-nowrap',
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

import { formatDateTime } from '@/components/dashboard/format';
import { LIMITATION_TEXT } from '@/lib/content/limitations';
import type { LimitationCode, ScanResult } from '@/lib/types';

export interface ScopeLimitationsProps {
  scan: ScanResult;
  // Limitations that the client adds from the PageSpeed outcome.
  performanceLimitations: LimitationCode[];
}

/** The fixed scope statement from spec 7.5, plus the limitations of this scan. */
export function ScopeLimitations({ scan, performanceLimitations }: ScopeLimitationsProps) {
  const limitations = [...new Set([...scan.limitations, ...performanceLimitations])];
  const loading =
    scan.loadedWith === 'firecrawl'
      ? 'SiteLens loaded the page in a browser with JavaScript (Firecrawl).'
      : 'SiteLens read the raw HTML of the page without JavaScript, because the browser load was not available.';

  return (
    <section aria-labelledby="scope-heading" className="rounded-lg border bg-card p-4 sm:p-5">
      <h2 id="scope-heading" className="text-base font-semibold text-foreground">
        Scope and limitations
      </h2>
      <ul className="mt-3 flex max-w-[72ch] list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground marker:text-border">
        <li>SiteLens checked only the homepage, the robots.txt file, and the sitemap. It did not check other pages.</li>
        <li>The results show the site at one point in time: {formatDateTime(scan.scannedAt)}.</li>
        <li>{loading}</li>
        <li>
          Lab performance data comes from a simulated test. Field data shows real Chrome users when Google has enough
          data.
        </li>
        <li>
          The UX, conversion, and AI search readiness items are observations from the page code. They are not results
          from user testing or analytics, and they do not guarantee an outcome.
        </li>
        <li>SiteLens had no access to the analytics, search console, or business data of the site.</li>
      </ul>
      {limitations.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <h3 className="text-sm font-semibold text-foreground">Limitations of this scan</h3>
          <ul className="mt-2 flex max-w-[72ch] list-disc flex-col gap-1.5 pl-5 text-sm text-foreground marker:text-border">
            {limitations.map((code) => (
              <li key={code}>{LIMITATION_TEXT[code]}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

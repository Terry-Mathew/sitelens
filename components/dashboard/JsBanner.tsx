import { Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { ScanResult } from '@/lib/types';

/** Shows when the raw HTML of the homepage looks like a JavaScript app shell. */
export function JsBanner({ scan }: { scan: ScanResult }) {
  if (!scan.jsRendered) return null;
  const loadedInBrowser = scan.loadedWith === 'firecrawl';
  return (
    <Alert className="border-sev-opportunity-border bg-sev-opportunity-bg">
      <Info className="text-sev-opportunity" aria-hidden="true" />
      <AlertTitle className="text-foreground">This page uses JavaScript to show its content</AlertTitle>
      <AlertDescription className="text-foreground/80">
        {loadedInBrowser
          ? 'SiteLens loaded the page in a browser, so the checks include content that JavaScript added.'
          : 'SiteLens could not load the page in a browser. Content that JavaScript adds was not checked.'}
      </AlertDescription>
    </Alert>
  );
}

'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { defaultDraft } from '@/lib/report/draft';
import { StorageFullError, saveScan } from '@/lib/storage';
import type { ScanResponse } from '@/lib/types';

const GENERIC_ERROR = 'The scan did not complete. Try again.';
const NO_CONNECTION = 'SiteLens could not connect. Try again.';
const SAVE_FAILED = 'SiteLens could not save the scan in this browser.';

/** Starts a scan of one homepage. A scan can take up to one minute. */
export function ScanForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // A ref blocks a second submit before React shows the disabled button.
  const running = useRef(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current) return;
    running.current = true;
    setPending(true);
    setError(null);

    let res: Response;
    try {
      res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
    } catch {
      setError(NO_CONNECTION);
      running.current = false;
      setPending(false);
      return;
    }

    try {
      const data: unknown = await res.json().catch(() => null);
      if (res.ok && data && typeof data === 'object' && 'scan' in data) {
        const { scan, performanceTicket } = data as ScanResponse;
        saveScan({ scan, performanceTicket, draft: defaultDraft(scan) });
        router.push(`/scan/${scan.id}`);
        return;
      }
      const message = (data as { error?: unknown } | null)?.error;
      setError(typeof message === 'string' ? message : GENERIC_ERROR);
    } catch (e) {
      setError(e instanceof StorageFullError ? e.message : SAVE_FAILED);
    }
    running.current = false;
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
      <Label htmlFor="scan-url">Website address</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="scan-url"
          name="url"
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          placeholder="example.com"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={pending ? 'scan-url-status' : error ? 'scan-url-error' : 'scan-url-help'}
          className="h-11 text-base sm:flex-1"
        />
        <Button type="submit" size="lg" className="h-11 px-5" disabled={pending || url.trim() === ''}>
          {pending ? (
            <>
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Scanning
            </>
          ) : (
            'Scan homepage'
          )}
        </Button>
      </div>
      {pending ? (
        <p id="scan-url-status" role="status" className="text-sm text-muted-foreground">
          <span>Checking the homepage…</span> <span>This can take up to one minute.</span>
        </p>
      ) : error ? (
        <p id="scan-url-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        <p id="scan-url-help" className="text-sm text-muted-foreground">
          SiteLens checks the homepage, the robots.txt file, and the sitemap.
        </p>
      )}
    </form>
  );
}

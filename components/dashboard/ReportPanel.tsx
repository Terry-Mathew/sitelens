'use client';

import { useId, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Download, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import type { ReportDocumentProps } from '@/components/report/ReportDocument';
import type { PageSpeedOutcome } from '@/lib/performance';
import { imageKind, isValidLogoDataUrl } from '@/lib/logo';
import { hasUnprintableText } from '@/lib/report/charset';
import type { ReportDraft } from '@/lib/report/draft';
import { formatDate, type Region } from '@/lib/report/region';
import { StorageFullError, getBranding, saveBranding, type Branding } from '@/lib/storage';
import type { ScanResult } from '@/lib/types';
import { cn } from '@/lib/utils';

// The PDF viewer works only in the browser.
const ReportPreview = dynamic(() => import('@/components/report/ReportPreview'), {
  ssr: false,
  loading: () => <Skeleton className="aspect-[210/297] w-full" />,
});

const MAX_NEXT_STEPS = 1500;
const MAX_LOGO_BYTES = 500 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg'];
const LOGO_ERROR = 'Logo must be a PNG or JPG under 500 KB.';
const BRANDING_SAVE_FAILED = 'SiteLens could not save the branding in this browser.';
const EXPORT_FAILED = 'SiteLens could not make the PDF. Try again.';
const FONT_WARNING =
  'Some characters in this report cannot be shown in the PDF font. Check the preview before you send it.';

const count = (n: number) => n.toLocaleString('en-US');

/** The file name of the exported PDF, for example website-review-example.com-2026-11-15.pdf. */
export function reportFileName(scan: ScanResult): string {
  let domain: string;
  try {
    domain = new URL(scan.finalUrl).hostname.replace(/^www\./, '');
  } catch {
    domain = 'website';
  }
  return `website-review-${domain.replace(/[^a-z0-9.-]/gi, '-')}-${scan.scannedAt.slice(0, 10)}.pdf`;
}

function read<T>(start: (reader: FileReader) => void, result: (reader: FileReader) => T): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(result(reader));
    reader.onerror = () => reject(reader.error);
    start(reader);
  });
}

// Returns a data URL for a real PNG or JPEG, or null. The first bytes decide the type, not the file name.
async function logoDataUrl(file: File): Promise<string | null> {
  const head = await read(
    (r) => r.readAsArrayBuffer(file.slice(0, 8)),
    (r) => new Uint8Array(r.result as ArrayBuffer),
  );
  const kind = imageKind(head);
  if (!kind) return null;
  const url = await read(
    (r) => r.readAsDataURL(file),
    (r) => String(r.result),
  );
  const data = url.replace(/^data:[^,]*;base64,/, `data:image/${kind};base64,`);
  return isValidLogoDataUrl(data) ? data : null;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before the URL is released.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ReportPanelProps {
  scan: ScanResult;
  pagespeed: PageSpeedOutcome | undefined;
  draft: ReportDraft;
  onDraftChange: (draft: ReportDraft) => void;
}

/** Branding, report fields, the live preview, and the PDF export. Evidence is not editable here. */
export function ReportPanel({ scan, pagespeed, draft, onDraftChange }: ReportPanelProps) {
  const id = useId();
  const [branding, setBranding] = useState<Branding>(() => getBranding());
  // The latest branding. The logo read is async, so it must not use an old copy from a closure.
  const latestBranding = useRef(branding);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // The preview and the export get the same props.
  const documentProps: ReportDocumentProps = { scan, pagespeed, draft, branding };
  const nextSteps = draft.nextSteps ?? '';
  const unprintable = hasUnprintableText(documentProps);

  function updateBranding(next: Branding) {
    latestBranding.current = next;
    setBranding(next);
    try {
      saveBranding(next);
      setBrandingError(null);
    } catch (e) {
      setBrandingError(e instanceof StorageFullError ? e.message : BRANDING_SAVE_FAILED);
    }
  }

  async function onLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = ''; // Lets the user pick the same file again.
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type) || file.size > MAX_LOGO_BYTES) {
      setLogoError(LOGO_ERROR);
      return;
    }
    try {
      // The logo stays in this browser. It is never uploaded.
      const data = await logoDataUrl(file);
      if (!data) {
        setLogoError(LOGO_ERROR);
        return;
      }
      setLogoError(null);
      updateBranding({ ...latestBranding.current, logoDataUrl: data });
    } catch {
      setLogoError(LOGO_ERROR);
    }
  }

  function removeLogo() {
    const next = { ...branding };
    delete next.logoDataUrl;
    updateBranding(next);
  }

  async function onExport() {
    setExporting(true);
    setExportError(null);
    try {
      const [{ pdf }, { ReportDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/report/ReportDocument'),
      ]);
      const blob = await pdf(<ReportDocument {...documentProps} />).toBlob();
      download(blob, reportFileName(scan));
    } catch {
      setExportError(EXPORT_FAILED);
    } finally {
      setExporting(false);
    }
  }

  const ids = {
    name: `${id}-name`,
    contact: `${id}-contact`,
    logo: `${id}-logo`,
    logoHelp: `${id}-logo-help`,
    region: `${id}-region`,
    client: `${id}-client`,
    steps: `${id}-steps`,
    stepsCount: `${id}-steps-count`,
  };

  return (
    <section aria-labelledby={`${id}-heading`} className="rounded-lg border bg-card">
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={`${id}-heading`} className="text-base font-semibold text-foreground">
              Client report
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">The PDF that you send to the business owner.</p>
          </div>
          <Button onClick={onExport} disabled={exporting} aria-busy={exporting || undefined}>
            <Download data-icon="inline-start" aria-hidden="true" />
            {exporting ? 'Exporting' : 'Export PDF'}
          </Button>
        </div>
        {unprintable && (
          <Alert>
            <TriangleAlert aria-hidden="true" />
            <AlertDescription>{FONT_WARNING}</AlertDescription>
          </Alert>
        )}
        {exportError && (
          <p role="alert" className="text-sm text-destructive">
            {exportError}
          </p>
        )}
        <ReportPreview {...documentProps} />
        <p className="text-xs text-muted-foreground">
          The preview updates when you make a change. The export is the same document.
        </p>
      </div>

      <div className="flex flex-col gap-4 border-t p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground">This report</h3>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.client}>Client business name</Label>
          <Input
            id={ids.client}
            value={draft.clientBusinessName ?? ''}
            maxLength={120}
            onChange={(e) => onDraftChange({ ...draft, clientBusinessName: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">The cover shows the domain when this is empty.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.steps}>Next steps</Label>
          <Textarea
            id={ids.steps}
            value={nextSteps}
            maxLength={MAX_NEXT_STEPS}
            rows={4}
            aria-describedby={ids.stepsCount}
            onChange={(e) => onDraftChange({ ...draft, nextSteps: e.target.value.slice(0, MAX_NEXT_STEPS) })}
          />
          <div className="flex justify-between gap-3 text-xs text-muted-foreground">
            <span>The report shows this note with your contact details.</span>
            <span
              id={ids.stepsCount}
              className={cn('shrink-0 tabular-nums', nextSteps.length >= MAX_NEXT_STEPS && 'text-foreground')}
            >
              {count(nextSteps.length)} / {count(MAX_NEXT_STEPS)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t p-4 sm:p-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Your branding</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            SiteLens keeps your branding in this browser and uses it for all reports.
          </p>
        </div>
        {brandingError && (
          <p role="alert" className="text-sm text-destructive">
            {brandingError}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.name}>Your name or business</Label>
          <Input
            id={ids.name}
            value={branding.name ?? ''}
            maxLength={120}
            onChange={(e) => updateBranding({ ...branding, name: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.contact}>Email or website</Label>
          <Input
            id={ids.contact}
            value={branding.contact ?? ''}
            maxLength={200}
            onChange={(e) => updateBranding({ ...branding, contact: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.logo}>Logo</Label>
          {branding.logoDataUrl && (
            <div className="flex items-center gap-3 rounded-md border bg-muted/50 p-2">
              {/* A data URL from the user's own file. next/image does not apply. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={branding.logoDataUrl} alt="Your logo" className="h-10 max-w-32 object-contain" />
              <Button variant="outline" size="sm" className="ml-auto" onClick={removeLogo}>
                Remove logo
              </Button>
            </div>
          )}
          <input
            id={ids.logo}
            type="file"
            accept="image/png,image/jpeg"
            aria-describedby={ids.logoHelp}
            aria-invalid={logoError ? true : undefined}
            onChange={onLogo}
            className="w-full rounded-lg text-sm text-muted-foreground outline-none file:mr-3 file:h-8 file:rounded-lg file:border file:border-border file:bg-background file:px-2.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <p
            id={ids.logoHelp}
            aria-live="polite"
            className={cn('text-xs', logoError ? 'text-destructive' : 'text-muted-foreground')}
          >
            {logoError ?? 'PNG or JPG, up to 500 KB. The logo stays in this browser.'}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.region}>Report region</Label>
          <select
            id={ids.region}
            value={branding.region}
            onChange={(e) => updateBranding({ ...branding, region: e.target.value as Region })}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="UK">UK: A4 paper, {formatDate(scan.scannedAt, 'UK')}</option>
            <option value="US">US: Letter paper, {formatDate(scan.scannedAt, 'US')}</option>
          </select>
        </div>
      </div>
    </section>
  );
}

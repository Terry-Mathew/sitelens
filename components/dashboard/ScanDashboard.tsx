'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { FindingGroups } from '@/components/dashboard/FindingGroups';
import { JsBanner } from '@/components/dashboard/JsBanner';
import { PerformancePanel } from '@/components/dashboard/PerformancePanel';
import { ReportPanel } from '@/components/dashboard/ReportPanel';
import { ScopeLimitations } from '@/components/dashboard/ScopeLimitations';
import { StatusLists } from '@/components/dashboard/StatusLists';
import { SummaryStrip } from '@/components/dashboard/SummaryStrip';
import { ClientOnly } from '@/components/dashboard/ClientOnly';
import { formatDateTime } from '@/components/dashboard/format';
import { performanceFindings } from '@/lib/checks/performance';
import type { PageSpeedOutcome } from '@/lib/performance';
import { withPerformanceDefaults, type ReportDraft } from '@/lib/report/draft';
import { StorageFullError, getScan, setPageSpeed, updateDraft, type ScanRecord } from '@/lib/storage';
import type { LimitationCode } from '@/lib/types';

type PageSpeedReply = { kind: 'ok'; outcome: PageSpeedOutcome } | { kind: 'login' } | { kind: 'failed' };

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const allNumbers = (o: unknown, keys: string[]) => isObject(o) && keys.every((k) => isNumber(o[k]));

// The body is saved and read on every visit, so check its full shape. A bad shape is never saved.
function isOutcome(value: unknown): value is PageSpeedOutcome {
  if (!isObject(value)) return false;
  if (value.ok === false) return typeof value.unavailable === 'string';
  if (value.ok !== true || !isObject(value.data) || !isObject(value.data.lab)) return false;
  const { lab, field } = value.data;
  if (!allNumbers(lab.scores, ['performance', 'accessibility', 'bestPractices', 'seo'])) return false;
  if (!allNumbers(lab.metrics, ['lcpMs', 'cls', 'tbtMs', 'fcpMs', 'speedIndexMs'])) return false;
  if (field === null) return true;
  if (!isObject(field) || (field.scope !== 'url' && field.scope !== 'origin')) return false;
  return ['lcp', 'inp', 'cls'].every((k) => field[k] === undefined || allNumbers(field[k], ['p75']));
}

async function requestPageSpeed(url: string, ticket: string): Promise<PageSpeedReply> {
  try {
    const res = await fetch('/api/pagespeed', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, ticket }),
    });
    if (res.status === 401) return { kind: 'login' };
    if (res.status !== 200) return { kind: 'failed' };
    const data: unknown = await res.json().catch(() => null);
    return isOutcome(data) ? { kind: 'ok', outcome: data } : { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  }
}

// Contract from Task 13: add the performance defaults once, when PageSpeed data first exists.
function withDefaults(record: ScanRecord): ScanRecord {
  if (!record.pagespeed || record.draft.performanceDefaulted) return record;
  return { ...record, draft: withPerformanceDefaults(record.draft, performanceFindings(record.pagespeed)) };
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const SAVE_FAILED = 'SiteLens could not save the change in this browser.';

function storageMessage(e: unknown): string {
  return e instanceof StorageFullError ? e.message : SAVE_FAILED;
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only" role="status">
        Loading the scan
      </span>
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-20" />
      <Skeleton className="h-64" />
      <Skeleton className="h-40" />
    </div>
  );
}

function NotSaved() {
  return (
    <div className="flex flex-col items-start gap-3 py-10">
      <h1 className="text-xl font-semibold text-foreground">This scan isn&apos;t saved in this browser.</h1>
      <p className="max-w-[60ch] text-sm text-muted-foreground">
        SiteLens keeps scans only in the browser that ran them. Run a new scan to see the results here.
      </p>
      <Link href="/" className="text-sm font-medium text-primary underline underline-offset-4">
        Start a new scan
      </Link>
    </div>
  );
}

interface InitialState {
  record: ScanRecord | null;
  storageError: string | null;
}

// Reads the saved scan. It also applies the Task 13 contract: when PageSpeed data exists
// and the defaults were not added, add them and save the draft. The write is idempotent.
function loadInitialState(id: string): InitialState {
  const stored = getScan(id);
  if (!stored?.pagespeed || stored.draft.performanceDefaulted) return { record: stored, storageError: null };
  const record = withDefaults(stored);
  try {
    updateDraft(id, record.draft);
    return { record, storageError: null };
  } catch (e) {
    return { record, storageError: storageMessage(e) };
  }
}

/** The technical view for one saved scan. Browser storage is read only in the browser. */
export function ScanDashboard({ id }: { id: string }) {
  return (
    <ClientOnly fallback={<DashboardSkeleton />}>
      <LoadedDashboard key={id} id={id} />
    </ClientOnly>
  );
}

function LoadedDashboard({ id }: { id: string }) {
  const router = useRouter();
  const [initial] = useState(() => loadInitialState(id));
  const [record, setRecord] = useState<ScanRecord | null>(initial.record);
  const [storageError, setStorageError] = useState<string | null>(initial.storageError);
  const [perfLoading, setPerfLoading] = useState(
    () => !!initial.record && !initial.record.pagespeed && !!initial.record.performanceTicket,
  );
  // The ticket is single-use. These refs stop a second request, also in React strict mode.
  const requested = useRef(false);
  const mounted = useRef(true);
  const routerRef = useRef(router);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const current = initial.record;
    if (!current || current.pagespeed || !current.performanceTicket || requested.current) return;
    requested.current = true;
    void requestPageSpeed(current.scan.url, current.performanceTicket).then((reply) => {
      if (reply.kind === 'login') {
        routerRef.current.push('/login');
        return;
      }
      let outcome: PageSpeedOutcome | null = null;
      let error: string | null = null;
      // Save only a 200 outcome. A failed request must not lock in an unavailable result.
      if (reply.kind === 'ok') {
        outcome = reply.outcome;
        try {
          setPageSpeed(id, reply.outcome);
          const saved = getScan(id);
          if (saved?.pagespeed) {
            // Another tab can have saved an outcome first. setPageSpeed keeps the first one.
            outcome = saved.pagespeed;
            const withPerf = withDefaults(saved);
            if (withPerf !== saved) updateDraft(id, withPerf.draft);
          }
        } catch (e) {
          error = storageMessage(e);
        }
      }
      if (!mounted.current) return;
      setPerfLoading(false);
      if (outcome) {
        const value = outcome;
        // Use the latest draft in memory, so a change made during the test stays.
        setRecord((r) => (r ? withDefaults({ ...r, pagespeed: value }) : r));
      }
      if (error) setStorageError(error);
    });
  }, [id, initial.record]);

  if (record === null) return <NotSaved />;

  const { scan, pagespeed, draft } = record;
  const perfFindings = pagespeed ? performanceFindings(pagespeed) : [];
  const findings = [...scan.findings, ...perfFindings];

  const performanceLimitations: LimitationCode[] = [];
  if (!perfLoading) {
    if (!pagespeed || !pagespeed.ok) performanceLimitations.push('performance_unavailable');
    else if (!pagespeed.data.field) performanceLimitations.push('field_data_unavailable');
  }

  function saveDraft(next: ReportDraft) {
    setRecord((r) => (r ? { ...r, draft: next } : r));
    try {
      updateDraft(id, next);
      setStorageError(null);
    } catch (e) {
      setStorageError(storageMessage(e));
    }
  }

  function onToggle(checkId: string, include: boolean) {
    const ids = draft.includedCheckIds.filter((x) => x !== checkId);
    saveDraft({ ...draft, includedCheckIds: include ? [...ids, checkId] : ids });
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          All scans
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight break-all text-foreground sm:text-3xl">
          {hostname(scan.finalUrl)}
        </h1>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Scanned URL</dt>
          <dd className="break-all text-foreground">{scan.url}</dd>
          {scan.finalUrl !== scan.url && (
            <>
              <dt className="text-muted-foreground">Final URL</dt>
              <dd className="break-all text-foreground">{scan.finalUrl}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Scanned on</dt>
          <dd className="text-foreground">{formatDateTime(scan.scannedAt)}</dd>
        </dl>
      </header>

      {storageError && (
        <Alert variant="destructive">
          <AlertTitle>Changes are not saved</AlertTitle>
          <AlertDescription>{storageError}</AlertDescription>
        </Alert>
      )}
      <JsBanner scan={scan} />
      <SummaryStrip findings={findings} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-10">
          <PerformancePanel
            outcome={pagespeed}
            loading={perfLoading}
            includePerformance={draft.includePerformance}
            onIncludeChange={(include) => saveDraft({ ...draft, includePerformance: include })}
          />
          <FindingGroups findings={findings} includedIds={draft.includedCheckIds} onToggle={onToggle} />
          <StatusLists findings={findings} includedIds={draft.includedCheckIds} onToggle={onToggle} />
          <ScopeLimitations scan={scan} performanceLimitations={performanceLimitations} />
        </div>
        {/* On wide screens the panel stays in view, so the preview shows each include choice. */}
        <aside className="min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto lg:rounded-lg">
          <ReportPanel scan={scan} pagespeed={pagespeed} draft={draft} onDraftChange={saveDraft} />
        </aside>
      </div>
    </div>
  );
}

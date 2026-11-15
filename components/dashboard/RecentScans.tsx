'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientOnly } from '@/components/dashboard/ClientOnly';
import { formatDateTime } from '@/components/dashboard/format';
import { StorageFullError, deleteScan, listScans, type ScanRecord } from '@/lib/storage';

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function issueSummary(record: ScanRecord): string {
  const failed = record.scan.findings.filter((f) => f.status === 'fail');
  const count = (s: string) => failed.filter((f) => f.severity === s).length;
  return `${count('critical')} critical, ${count('warning')} warning, ${count('opportunity')} opportunity`;
}

/** Scans saved in this browser. The newest scan is first. */
export function RecentScans() {
  return (
    <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
      <h2 id="recent-heading" className="text-base font-semibold text-foreground">
        Recent scans
      </h2>
      <ClientOnly
        fallback={
          <div aria-busy="true" className="flex flex-col gap-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        }
      >
        <ScanList />
      </ClientOnly>
    </section>
  );
}

function ScanList() {
  // Browser storage exists only in the browser. ClientOnly renders this component there.
  const [records, setRecords] = useState<ScanRecord[]>(listScans);
  const [error, setError] = useState<string | null>(null);

  function onDelete(id: string) {
    try {
      deleteScan(id);
      setError(null);
    } catch (e) {
      setError(e instanceof StorageFullError ? e.message : 'SiteLens could not delete the scan.');
    }
    setRecords(listScans());
  }

  return (
    <>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {records.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
          No saved scans. Enter a website address above to run your first scan.
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {records.map((record) => {
            const host = hostname(record.scan.finalUrl);
            return (
              <li key={record.scan.id} className="flex items-center gap-3 px-4 py-3">
                <Link
                  href={`/scan/${record.scan.id}`}
                  className="min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="block truncate font-medium text-foreground hover:underline">{host}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {formatDateTime(record.scan.scannedAt)}. {issueSummary(record)}.
                  </span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete the scan of ${host}`}
                  onClick={() => onDelete(record.scan.id)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

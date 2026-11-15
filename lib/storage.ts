import { isValidLogoDataUrl } from '@/lib/logo';
import type { PageSpeedOutcome } from '@/lib/performance';
import type { ReportDraft } from '@/lib/report/draft';
import type { Region } from '@/lib/report/region';
import type { ScanResult } from '@/lib/types';

// Browser storage keeps only scans, report drafts, and branding. It never keeps a credential.
const SCANS_KEY = 'sitelens:scans';
const BRANDING_KEY = 'sitelens:branding';
const PREFIX = 'sitelens:';
const MAX_SCANS = 10;

export interface Branding {
  name?: string;
  logoDataUrl?: string;
  contact?: string;
  region: Region;
}

export interface ScanRecord {
  scan: ScanResult;
  performanceTicket?: string; // Deleted once PageSpeed data is saved.
  pagespeed?: PageSpeedOutcome;
  draft: ReportDraft;
}

export class StorageFullError extends Error {
  constructor() {
    super('Browser storage is full. Delete old scans or use a smaller logo.');
    this.name = 'StorageFullError';
  }
}

function isQuotaError(e: unknown): boolean {
  const err = e as { name?: string; code?: number } | null;
  // Firefox uses its own name and code 1014.
  return (
    err?.name === 'QuotaExceededError' ||
    err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err?.code === 22 ||
    err?.code === 1014
  );
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function listScans(): ScanRecord[] {
  const value = read<unknown>(SCANS_KEY, []);
  return Array.isArray(value) ? (value as ScanRecord[]) : [];
}

export function getScan(id: string): ScanRecord | null {
  return listScans().find((r) => r.scan.id === id) ?? null;
}

// Write the list. On a full quota, drop the oldest record and try again.
function writeScans(records: ScanRecord[]): void {
  let list = records;
  for (;;) {
    try {
      localStorage.setItem(SCANS_KEY, JSON.stringify(list));
      return;
    } catch (e) {
      if (!isQuotaError(e)) return; // Storage is blocked. The app still works for this session.
      if (list.length <= 1) throw new StorageFullError();
      list = list.slice(0, -1);
    }
  }
}

export function saveScan(record: ScanRecord): void {
  const others = listScans().filter((r) => r.scan.id !== record.scan.id);
  writeScans([record, ...others].slice(0, MAX_SCANS));
}

function updateRecord(id: string, change: (r: ScanRecord) => ScanRecord): void {
  const records = listScans();
  if (!records.some((r) => r.scan.id === id)) return;
  writeScans(records.map((r) => (r.scan.id === id ? change(r) : r)));
}

export function updateDraft(id: string, draft: ReportDraft): void {
  updateRecord(id, (r) => ({ ...r, draft }));
}

// Save the first outcome only. A later outcome must not replace it.
export function setPageSpeed(id: string, outcome: PageSpeedOutcome): void {
  updateRecord(id, (r) => {
    if (r.pagespeed) return r;
    const next: ScanRecord = { ...r, pagespeed: outcome };
    delete next.performanceTicket;
    return next;
  });
}

export function deleteScan(id: string): void {
  writeScans(listScans().filter((r) => r.scan.id !== id));
}

export function getBranding(): Branding {
  const value = read<Partial<Branding> | null>(BRANDING_KEY, null);
  const branding: Branding = { ...value, region: value?.region === 'US' ? 'US' : 'UK' };
  // A stored logo that is not a real PNG or JPEG would break every PDF. Drop it.
  if ('logoDataUrl' in branding && !isValidLogoDataUrl(branding.logoDataUrl)) delete branding.logoDataUrl;
  return branding;
}

export function saveBranding(branding: Branding): void {
  try {
    localStorage.setItem(BRANDING_KEY, JSON.stringify(branding));
  } catch (e) {
    if (isQuotaError(e)) throw new StorageFullError();
  }
}

export function clearAll(): void {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // Storage is blocked. There is nothing to clear.
  }
}

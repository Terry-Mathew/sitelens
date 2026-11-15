// @vitest-environment jsdom
// File is .tsx so the jsdom project runs it. The comment keeps it explicit.
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  listScans, getScan, saveScan, updateDraft, setPageSpeed, getBranding, saveBranding,
  deleteScan, clearAll, StorageFullError,
} from '@/lib/storage';
import { defaultDraft } from '@/lib/report/draft';
import type { ScanRecord } from '@/lib/storage';
import { scanWith, psOk } from './report/fixtures';

function record(id: string): ScanRecord {
  const scan = scanWith([], { id });
  return { scan, draft: defaultDraft(scan) };
}

function quotaError() {
  return new DOMException('full', 'QuotaExceededError');
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('storage', () => {
  it('keeps only the 10 most recent scans, newest first', () => {
    for (let i = 1; i <= 12; i++) saveScan(record(`s${i}`));
    const ids = listScans().map((r) => r.scan.id);
    expect(ids).toHaveLength(10);
    expect(ids[0]).toBe('s12');
    expect(ids[9]).toBe('s3');
  });

  it('replaces a record with the same id', () => {
    saveScan(record('a'));
    saveScan(record('b'));
    saveScan(record('a'));
    expect(listScans().map((r) => r.scan.id)).toEqual(['a', 'b']);
  });

  it('drops the oldest scan and retries on QuotaExceededError', () => {
    for (let i = 1; i <= 3; i++) saveScan(record(`s${i}`));
    const real = Storage.prototype.setItem;
    let calls = 0;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      calls++;
      if (calls <= 2) throw quotaError();
      return real.call(this, k, v);
    });
    saveScan(record('s4'));
    expect(listScans().map((r) => r.scan.id)).toEqual(['s4', 's3']);
  });

  it('throws StorageFullError when still full with one scan', () => {
    saveScan(record('s1'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quotaError();
    });
    expect(() => saveScan(record('s2'))).toThrow(StorageFullError);
    expect(() => saveScan(record('s2'))).toThrow(
      'Browser storage is full. Delete old scans or use a smaller logo.',
    );
  });

  it('also treats error code 22 as a full quota', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw Object.assign(new Error('full'), { code: 22 });
    });
    expect(() => saveScan(record('x'))).toThrow(StorageFullError);
  });

  it('treats the Firefox quota error as a full quota', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'NS_ERROR_DOM_QUOTA_REACHED');
    });
    expect(() => saveScan(record('x'))).toThrow(StorageFullError);
    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw Object.assign(new Error('full'), { code: 1014 });
    });
    expect(() => saveScan(record('y'))).toThrow(StorageFullError);
  });

  it('survives localStorage throwing on access', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(listScans()).toEqual([]);
    expect(getScan('a')).toBeNull();
    expect(getBranding()).toEqual({ region: 'UK' });
  });

  it('survives corrupt JSON', () => {
    localStorage.setItem('sitelens:scans', '{oops');
    localStorage.setItem('sitelens:branding', '{oops');
    expect(listScans()).toEqual([]);
    expect(getBranding()).toEqual({ region: 'UK' });
  });

  it('does not throw when removal or clear is blocked', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => clearAll()).not.toThrow();
  });

  it('gets, updates the draft, and deletes a scan', () => {
    saveScan(record('a'));
    expect(getScan('a')?.scan.id).toBe('a');
    updateDraft('a', { ...defaultDraft(record('a').scan), nextSteps: 'Call us.' });
    expect(getScan('a')?.draft.nextSteps).toBe('Call us.');
    deleteScan('a');
    expect(getScan('a')).toBeNull();
  });

  it('setPageSpeed does not overwrite an existing outcome and deletes the ticket', () => {
    saveScan({ ...record('a'), performanceTicket: 'ticket' });
    const first = psOk(true, 20);
    setPageSpeed('a', first);
    expect(getScan('a')?.pagespeed).toEqual(first);
    expect(getScan('a')?.performanceTicket).toBeUndefined();
    setPageSpeed('a', psOk(true, 99));
    expect(getScan('a')?.pagespeed).toEqual(first);
  });

  it('branding defaults to UK and round-trips', () => {
    expect(getBranding()).toEqual({ region: 'UK' });
    saveBranding({ name: 'Acme', region: 'US' });
    expect(getBranding()).toEqual({ name: 'Acme', region: 'US' });
  });

  it('clearAll removes all sitelens:* keys and nothing else', () => {
    saveScan(record('a'));
    saveBranding({ region: 'UK' });
    localStorage.setItem('other', 'keep');
    clearAll();
    expect(localStorage.getItem('sitelens:scans')).toBeNull();
    expect(localStorage.getItem('sitelens:branding')).toBeNull();
    expect(localStorage.getItem('other')).toBe('keep');
  });

  it('never stores keys or values with access code or session data', () => {
    saveScan(record('a'));
    saveBranding({ name: 'Acme', region: 'UK' });
    const keys = Object.keys(localStorage).sort();
    expect(keys).toEqual(['sitelens:branding', 'sitelens:scans']);
    const all = keys.map((k) => k + localStorage.getItem(k)).join('');
    expect(all).not.toContain('sitelens_session');
    expect(all.toLowerCase()).not.toContain('access');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { pagespeedOk, scan } from './fixtures';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

import { ScanDashboard } from '@/components/dashboard/ScanDashboard';
import { LIMITATION_TEXT } from '@/lib/content/limitations';
import { defaultDraft } from '@/lib/report/draft';
import * as storage from '@/lib/storage';

beforeEach(() => {
  storage.saveScan({ scan, performanceTicket: 'ticket-1', draft: defaultDraft(scan) });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('ScanDashboard', () => {
  it('shows the not-saved message for an unknown scan id', async () => {
    render(<ScanDashboard id="missing" />);
    expect(await screen.findByText("This scan isn't saved in this browser.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /new scan/i })).toHaveAttribute('href', '/');
  });

  it('a 403 response does not call setPageSpeed', async () => {
    const setPageSpeed = vi.spyOn(storage, 'setPageSpeed');
    const fetchMock = vi.fn(async () => Response.json({ error: 'This ticket was used.' }, { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<ScanDashboard id="scan-1" />);
    expect(await screen.findByText('Performance data unavailable')).toBeInTheDocument();
    expect(screen.getByText(LIMITATION_TEXT.performance_unavailable, { selector: 'p' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(setPageSpeed).not.toHaveBeenCalled();
    expect(storage.getScan('scan-1')?.performanceTicket).toBe('ticket-1');
  });

  it('saves a 200 outcome once and adds the performance defaults to the draft', async () => {
    const fetchMock = vi.fn(async () => Response.json(pagespeedOk));
    vi.stubGlobal('fetch', fetchMock);

    render(<ScanDashboard id="scan-1" />);
    expect(await screen.findByText('Google Lighthouse (lab, mobile)')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/pagespeed',
      expect.objectContaining({ body: JSON.stringify({ url: scan.url, ticket: 'ticket-1' }) }),
    );
    await waitFor(() => expect(storage.getScan('scan-1')?.draft.performanceDefaulted).toBe(true));
    const record = storage.getScan('scan-1');
    expect(record?.pagespeed).toEqual(pagespeedOk);
    expect(record?.performanceTicket).toBeUndefined();
    expect(record?.draft.includedCheckIds).toContain('lab-performance');
  });

  it('shows summary counts without observations', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(pagespeedOk)));
    render(<ScanDashboard id="scan-1" />);
    const strip = await screen.findByRole('region', { name: 'Summary' });
    expect(strip).toHaveTextContent('Critical0');
    expect(strip).toHaveTextContent('Opportunity1');
  });
});

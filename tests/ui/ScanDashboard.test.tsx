import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { pagespeedOk, scan } from './fixtures';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
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
  push.mockReset();
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

  it('does not save a 200 body with an invalid shape', async () => {
    const setPageSpeed = vi.spyOn(storage, 'setPageSpeed');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true, data: { lab: { scores: {} } } })));

    render(<ScanDashboard id="scan-1" />);
    expect(await screen.findByText('Performance data unavailable')).toBeInTheDocument();
    expect(screen.getByText(LIMITATION_TEXT.performance_unavailable, { selector: 'p' })).toBeInTheDocument();
    expect(setPageSpeed).not.toHaveBeenCalled();
    expect(storage.getScan('scan-1')?.pagespeed).toBeUndefined();
  });

  it('does not call /api/pagespeed when the record already has PageSpeed data', async () => {
    storage.saveScan({ scan, pagespeed: pagespeedOk, draft: defaultDraft(scan) });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<ScanDashboard id="scan-1" />);
    expect(await screen.findByText('Google Lighthouse (lab, mobile)')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    // The defaults contract runs on load.
    expect(storage.getScan('scan-1')?.draft.performanceDefaulted).toBe(true);
  });

  it('sends the user to the login page when /api/pagespeed returns 401', async () => {
    const setPageSpeed = vi.spyOn(storage, 'setPageSpeed');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Sign in again.' }, { status: 401 })));

    render(<ScanDashboard id="scan-1" />);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
    expect(setPageSpeed).not.toHaveBeenCalled();
  });
});

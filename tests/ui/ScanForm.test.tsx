import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { scan } from './fixtures';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

import { ScanForm } from '@/components/dashboard/ScanForm';
import { getScan } from '@/lib/storage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockReset();
  localStorage.clear();
});

describe('ScanForm', () => {
  it('ScanForm shows the API error message and re-enables submit', async () => {
    let resolve: (r: Response) => void = () => {};
    const fetchMock = vi.fn(() => new Promise<Response>((r) => (resolve = r)));
    vi.stubGlobal('fetch', fetchMock);

    render(<ScanForm />);
    fireEvent.change(screen.getByLabelText('Website address'), { target: { value: 'example.com' } });
    const submit = screen.getByRole('button', { name: 'Scan homepage' });
    fireEvent.click(submit);

    expect(await screen.findByText('Checking the homepage…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Scanning/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Scanning/ }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolve(Response.json({ error: 'Enter a valid website address.' }, { status: 400 }));
    expect(await screen.findByText('Enter a valid website address.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scan homepage' })).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it('ScanForm saves the scan with a default draft and opens the dashboard', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ scan, performanceTicket: 't1' })));

    render(<ScanForm />);
    fireEvent.change(screen.getByLabelText('Website address'), { target: { value: 'example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Scan homepage' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/scan/scan-1'));
    const saved = getScan('scan-1');
    expect(saved?.performanceTicket).toBe('t1');
    expect(saved?.draft.includedCheckIds).toEqual(['title']);
  });

  it('ScanForm sends the user to the login page on 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Sign in again.' }, { status: 401 })));
    render(<ScanForm />);
    fireEvent.change(screen.getByLabelText('Website address'), { target: { value: 'example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Scan homepage' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
  });
});

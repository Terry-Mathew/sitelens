import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { scan } from './fixtures';

// The live preview needs a real browser PDF viewer. These tests check the panel only.
vi.mock('next/dynamic', () => ({ default: () => () => null }));

const toBlob = vi.fn(async () => new Blob(['%PDF'], { type: 'application/pdf' }));
vi.mock('@react-pdf/renderer', async (original) => ({
  ...(await original<typeof import('@react-pdf/renderer')>()),
  pdf: () => ({ toBlob }),
}));

import { ReportPanel, reportFileName } from '@/components/dashboard/ReportPanel';
import { defaultDraft, type ReportDraft } from '@/lib/report/draft';
import * as storage from '@/lib/storage';

const LOGO_ERROR = 'Logo must be a PNG or JPG under 500 KB.';

function setup(draft: ReportDraft = defaultDraft(scan)) {
  const onDraftChange = vi.fn();
  render(<ReportPanel scan={scan} pagespeed={undefined} draft={draft} onDraftChange={onDraftChange} />);
  return { onDraftChange };
}

function upload(file: File) {
  fireEvent.change(screen.getByLabelText('Logo'), {
    target: { files: [file] },
  });
}

beforeEach(() => localStorage.clear());

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  toBlob.mockClear();
  localStorage.clear();
});

describe('ReportPanel logo', () => {
  it('rejects a file that is not PNG or JPG', async () => {
    setup();
    upload(new File(['gif'], 'logo.gif', { type: 'image/gif' }));
    expect(await screen.findByText(LOGO_ERROR)).toBeInTheDocument();
    expect(storage.getBranding().logoDataUrl).toBeUndefined();
  });

  it('rejects a PNG larger than 500 KB', async () => {
    setup();
    upload(
      new File([new Uint8Array(500 * 1024 + 1)], 'logo.png', {
        type: 'image/png',
      }),
    );
    expect(await screen.findByText(LOGO_ERROR)).toBeInTheDocument();
    expect(storage.getBranding().logoDataUrl).toBeUndefined();
  });

  it('reads a small JPG to a data URL and saves it with the branding', async () => {
    setup();
    upload(
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'logo.jpg', {
        type: 'image/jpeg',
      }),
    );
    await waitFor(() => expect(storage.getBranding().logoDataUrl).toMatch(/^data:image\/jpeg;base64,/));
    expect(screen.queryByText(LOGO_ERROR)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove logo' })).toBeInTheDocument();
  });

  it('shows the storage message when the browser storage is full', async () => {
    vi.spyOn(storage, 'saveBranding').mockImplementation(() => {
      throw new storage.StorageFullError();
    });
    setup();
    fireEvent.change(screen.getByLabelText('Your name or business'), {
      target: { value: 'Harbour Web Studio' },
    });
    expect(await screen.findByText(new storage.StorageFullError().message)).toBeInTheDocument();
  });
});

describe('ReportPanel fields', () => {
  it('saves the name, contact, and region with the branding', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Your name or business'), {
      target: { value: 'Harbour Web Studio' },
    });
    fireEvent.change(screen.getByLabelText('Email or website'), {
      target: { value: 'hello@harbourweb.co.uk' },
    });
    fireEvent.change(screen.getByLabelText('Report region'), {
      target: { value: 'US' },
    });
    expect(storage.getBranding()).toEqual({
      region: 'US',
      name: 'Harbour Web Studio',
      contact: 'hello@harbourweb.co.uk',
    });
  });

  it('sends the client business name to the draft', () => {
    const { onDraftChange } = setup();
    fireEvent.change(screen.getByLabelText('Client business name'), {
      target: { value: 'Smith & Sons' },
    });
    expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({ clientBusinessName: 'Smith & Sons' }));
  });

  it('limits next steps to 1,500 characters and shows a live counter', () => {
    const { onDraftChange } = setup({
      ...defaultDraft(scan),
      nextSteps: 'Call me.',
    });
    const box = screen.getByLabelText('Next steps');
    expect(box).toHaveAttribute('maxLength', '1500');
    expect(screen.getByText('8 / 1,500')).toBeInTheDocument();

    fireEvent.change(box, { target: { value: 'x'.repeat(1600) } });
    const sent = onDraftChange.mock.lastCall?.[0] as ReportDraft;
    expect(sent.nextSteps).toHaveLength(1500);
  });
});

describe('ReportPanel export', () => {
  it('names the file with the domain and the date of the scan', () => {
    expect(reportFileName(scan)).toBe('website-review-example.com-2026-11-15.pdf');
    expect(reportFileName({ ...scan, finalUrl: 'https://www.xn--caf-dma.fr/' })).toBe(
      'website-review-xn--caf-dma.fr-2026-11-15.pdf',
    );
  });

  it('downloads the PDF that react-pdf makes', async () => {
    const createObjectURL = vi.fn(() => 'blob:report');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(toBlob).toHaveBeenCalledTimes(1);
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('website-review-example.com-2026-11-15.pdf');
    expect(anchor.href).toBe('blob:report');
    vi.unstubAllGlobals();
  });
});

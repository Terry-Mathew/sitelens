import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

import LoginPage from '@/app/login/page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  replace.mockReset();
});

describe('LoginPage', () => {
  it('shows the error text on a 401 response', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ error: "That code didn't work." }, { status: 401 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Access code'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText("That code didn't work.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/login',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ code: 'wrong' }) }),
    );
    expect(replace).not.toHaveBeenCalled();
  });
});

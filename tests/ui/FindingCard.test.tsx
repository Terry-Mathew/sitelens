import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FindingCard } from '@/components/dashboard/FindingCard';
import { failedTitle, unableFinding } from './fixtures';

afterEach(cleanup);

describe('FindingCard', () => {
  it('FindingCard renders evidence as text, with no editable inputs other than the include switch', () => {
    const { container } = render(<FindingCard finding={failedTitle} included onToggle={vi.fn()} />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('og:title, og:image')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(container.querySelectorAll('textarea, select, [contenteditable="true"]')).toHaveLength(0);
    // Only the include switch can change. Base UI adds one hidden checkbox for the switch.
    const visibleInputs = [...container.querySelectorAll('input')].filter((i) => i.type !== 'checkbox');
    expect(visibleInputs).toHaveLength(0);
    expect(screen.getAllByRole('switch')).toHaveLength(1);
    expect(screen.getByRole('switch', { name: 'Include in client report' })).toBeChecked();
  });

  it('FindingCard toggle calls onToggle(checkId, false) and shows Restore when excluded', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<FindingCard finding={failedTitle} included onToggle={onToggle} />);
    expect(screen.queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'Include in client report' }));
    expect(onToggle).toHaveBeenCalledWith('title', false);

    rerender(<FindingCard finding={failedTitle} included={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(onToggle).toHaveBeenLastCalledWith('title', true);
  });

  it('FindingCard hides the switch for unable_to_check', () => {
    render(<FindingCard finding={unableFinding} included={false} onToggle={vi.fn()} />);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument();
    expect(screen.getByText('The sitemap could not be read')).toBeInTheDocument();
  });

  it('FindingCard shows a Heuristic tag with an explanation for heuristic checks', () => {
    render(
      <FindingCard
        finding={{ ...failedTitle, checkId: 'contact-method', category: 'conversion', confidence: 'heuristic' }}
        included
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText('Heuristic')).toBeInTheDocument();
    expect(screen.getByLabelText(/Based on page code patterns, not user testing\./)).toBeInTheDocument();
  });
});

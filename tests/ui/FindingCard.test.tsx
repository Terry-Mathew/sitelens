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
    expect(screen.getByRole('switch', { name: 'Include in client report: Title tag' })).toBeChecked();
  });

  it('FindingCard toggle calls onToggle(checkId, false) and shows Add to report when excluded', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<FindingCard finding={failedTitle} included onToggle={onToggle} />);
    expect(screen.queryByRole('button', { name: /Add to report/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'Include in client report: Title tag' }));
    expect(onToggle).toHaveBeenCalledWith('title', false);

    rerender(<FindingCard finding={failedTitle} included={false} onToggle={onToggle} />);
    expect(screen.queryByRole('button', { name: /Restore/ })).not.toBeInTheDocument();
    expect(screen.getByText('Not in client report')).toBeInTheDocument();
    const add = screen.getByRole('button', { name: 'Add to report: Title tag' });
    expect(add).toHaveTextContent('Add to report');
    fireEvent.click(add);
    expect(onToggle).toHaveBeenLastCalledWith('title', true);
  });

  it('FindingCard keeps full contrast when excluded (no opacity dimming)', () => {
    const { container } = render(<FindingCard finding={failedTitle} included={false} onToggle={vi.fn()} />);
    // Only an unconditional opacity class lowers contrast. Variants such as disabled:opacity-50 do not apply here.
    const dimmed = [...container.querySelectorAll('*')].filter((el) =>
      /(^|\s)opacity-\d+/.test(el.getAttribute('class') ?? ''),
    );
    expect(dimmed).toHaveLength(0);
    expect(container.querySelector('article')).toHaveAttribute('data-excluded');
  });

  it('FindingCard hides the switch for unable_to_check', () => {
    render(<FindingCard finding={unableFinding} included={false} onToggle={vi.fn()} />);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
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
    expect(screen.getByRole('note')).toHaveTextContent('Heuristic: based on page code patterns, not user testing.');
    expect(screen.getByRole('switch', { name: 'Include in client report: Contact method' })).toBeInTheDocument();
  });
});

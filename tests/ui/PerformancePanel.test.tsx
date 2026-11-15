import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PerformancePanel } from '@/components/dashboard/PerformancePanel';
import { LIMITATION_TEXT } from '@/lib/content/limitations';
import { pagespeedData, pagespeedOk } from './fixtures';

afterEach(cleanup);

const base = { loading: false, includePerformance: true, onIncludeChange: vi.fn() };

describe('PerformancePanel', () => {
  it('PerformancePanel shows "Google does not have enough real-user data for this site." when field null', () => {
    render(<PerformancePanel {...base} outcome={pagespeedOk} />);
    expect(screen.getByText('Google Lighthouse (lab, mobile)')).toBeInTheDocument();
    expect(screen.getByText('Real-user data (Google)')).toBeInTheDocument();
    expect(screen.getByText('Google does not have enough real-user data for this site.')).toBeInTheDocument();
    // Display format only: 4230 ms is 4.2 s, CLS has 2 decimals, TBT stays in ms.
    expect(screen.getByText('4.2 s')).toBeInTheDocument();
    expect(screen.getByText('0.12')).toBeInTheDocument();
    expect(screen.getByText('610 ms')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('PerformancePanel shows "Performance data unavailable" + reason when unavailable', () => {
    render(<PerformancePanel {...base} outcome={{ ok: false, unavailable: 'Google did not respond in time.' }} />);
    expect(screen.getByText('Performance data unavailable')).toBeInTheDocument();
    expect(screen.getByText('Google did not respond in time.')).toBeInTheDocument();
    expect(screen.queryByText('Google Lighthouse (lab, mobile)')).not.toBeInTheDocument();
  });

  it('PerformancePanel shows the limitation text when there is no outcome', () => {
    render(<PerformancePanel {...base} outcome={undefined} />);
    expect(screen.getByText('Performance data unavailable')).toBeInTheDocument();
    expect(screen.getByText(LIMITATION_TEXT.performance_unavailable)).toBeInTheDocument();
  });

  it('PerformancePanel shows field scope and ratings', () => {
    const outcome = {
      ok: true as const,
      data: {
        ...pagespeedData,
        field: { scope: 'origin' as const, lcp: { p75: 2900, rating: 'needs-improvement' as const } },
      },
    };
    render(<PerformancePanel {...base} outcome={outcome} />);
    expect(screen.getByText('Whole site')).toBeInTheDocument();
    expect(screen.getByText('2.9 s')).toBeInTheDocument();
    expect(screen.getByText('Needs improvement')).toBeInTheDocument();
    expect(screen.getAllByText('Not available').length).toBeGreaterThan(0);
  });

  it('PerformancePanel include switch reports the new value', () => {
    const onIncludeChange = vi.fn();
    render(<PerformancePanel {...base} onIncludeChange={onIncludeChange} outcome={pagespeedOk} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Include performance in client report' }));
    expect(onIncludeChange).toHaveBeenCalledWith(false);
  });
});

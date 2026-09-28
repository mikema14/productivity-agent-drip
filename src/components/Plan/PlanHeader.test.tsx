import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlanHeader from './PlanHeader';

describe('PlanHeader', () => {
  it('renders the title and the week label for an injected date', () => {
    render(<PlanHeader date={new Date(2026, 8, 25)} />);
    expect(screen.getByRole('heading', { name: 'Plan' })).toBeInTheDocument();
    expect(screen.getByTestId('plan-header')).toHaveTextContent('Week 39 · 21–27 Sep');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is a drag region like the Now header', () => {
    render(<PlanHeader date={new Date(2026, 8, 25)} />);
    const appRegion = (el: HTMLElement) => (el.style as unknown as Record<string, string>).WebkitAppRegion;
    expect(appRegion(screen.getByTestId('plan-header'))).toBe('drag');
  });
});

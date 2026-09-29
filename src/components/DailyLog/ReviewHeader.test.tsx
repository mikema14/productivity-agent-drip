import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewHeader from './ReviewHeader';

vi.mock('./CalendarPopover', () => ({
  default: ({ onSelectDate, onClose }: { onSelectDate: (d: string) => void; onClose: () => void }) => (
    <div data-testid="calendar-popover">
      <button onClick={() => onSelectDate('2026-09-01')}>pick 1 Sep</button>
      <button onClick={onClose}>close popover</button>
    </div>
  ),
}));


function renderHeader(overrides: Partial<React.ComponentProps<typeof ReviewHeader>> = {}) {
  const props = {
    date: '2026-09-25', today: '2026-09-25', onPrev: vi.fn(), onNext: vi.fn(), onSelectDate: vi.fn(), onSync: vi.fn(), isSyncing: false, trackedMinutes: 340, billableMinutes: 265, ...overrides,
  };
  render(<ReviewHeader {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('ReviewHeader', () => {
  it('renders Review, the date with a Today suffix, and fires prev / next', async () => {
    const { user, onPrev, onNext } = renderHeader();
    expect(screen.getByRole('heading', { name: 'Review' })).toBeInTheDocument();
    expect(screen.getByTestId('review-date')).toHaveTextContent('Fri 25 Sep · Today');
    await user.click(screen.getByRole('button', { name: 'Previous day' }));
    await user.click(screen.getByRole('button', { name: 'Next day' }));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect((screen.getByTestId('review-header').style as unknown as Record<string, string>).WebkitAppRegion).toBe('drag');
  });

  it('shows no Today suffix on another day', () => {
    renderHeader({ date: '2026-09-24' });
    expect(screen.getByTestId('review-date')).toHaveTextContent('Thu 24 Sep');
    expect(screen.getByTestId('review-date')).not.toHaveTextContent('Today');
  });

  it('the date button opens the month popover; picking a day calls onSelectDate and closes it', async () => {
    const { user, onSelectDate } = renderHeader();
    await user.click(screen.getByTestId('review-date'));
    expect(screen.getByTestId('calendar-popover')).toBeInTheDocument();
    await user.click(screen.getByText('pick 1 Sep'));
    expect(onSelectDate).toHaveBeenCalledWith('2026-09-01');
    expect(screen.queryByTestId('calendar-popover')).toBeNull();
  });

  it('the sync key calls onSync and shows the spinner state while syncing', async () => {
    const { user, onSync } = renderHeader();
    const sync = screen.getByRole('button', { name: 'Sync calendar' });
    expect(sync).toHaveAttribute('title', 'Sync calendar');
    await user.click(sync);
    expect(onSync).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sync-icon')).not.toHaveClass('animate-spin');
  });

  it('while syncing the key is disabled with the syncing title and spinning icon', () => {
    renderHeader({ isSyncing: true });
    const sync = screen.getByRole('button', { name: 'Sync calendar' });
    expect(sync).toBeDisabled();
    expect(sync).toHaveAttribute('title', 'Syncing calendar...');
    expect(screen.getByTestId('sync-icon')).toHaveClass('animate-spin');
  });

  it('renders only `tracked · billable` in mono on the right (R24)', () => {
    renderHeader();
    const s = screen.getByTestId('review-stats');
    expect(s).toHaveTextContent('5h 40m tracked · 4h 25m billable');
    expect(s).toHaveClass('font-mono');
    expect(s).not.toHaveTextContent(/to log|break|logged/);
  });

  it('zero minutes read `0m`', () => {
    renderHeader({ trackedMinutes: 0, billableMinutes: 0 });
    expect(screen.getByTestId('review-stats')).toHaveTextContent('0m tracked · 0m billable');
  });
});

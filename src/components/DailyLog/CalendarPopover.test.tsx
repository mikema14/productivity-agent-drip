import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import CalendarPopover from './CalendarPopover';
import { useLogStore } from '../../stores/logStore';

/**
 * The month grid's `Today` key and ring use the local calendar day. At 00:30
 * CEST the UTC date is still yesterday.
 */
describe('CalendarPopover — Today is the local date', () => {
  const previousTZ = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = 'Europe/Prague';
    vi.useFakeTimers({ now: new Date(2026, 8, 26, 0, 30, 0) });
    useLogStore.setState({ getMonthlyStats: vi.fn(async () => ({ dailyMinutes: [] })) } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = previousTZ;
  });

  it('Today selects 2026-09-26 at 00:30 local and is hidden once that day is selected', async () => {
    expect(new Date().toISOString().split('T')[0]).toBe('2026-09-25');
    const onSelectDate = vi.fn();
    const { rerender } = render(<CalendarPopover selectedDate="2026-09-20" onSelectDate={onSelectDate} onClose={() => {}} />);
    await act(async () => { await Promise.resolve(); });

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(onSelectDate).toHaveBeenCalledWith('2026-09-26');

    rerender(<CalendarPopover selectedDate="2026-09-26" onSelectDate={onSelectDate} onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull();
  });
});

describe('CalendarPopover — placement', () => {
  beforeEach(() => {
    useLogStore.setState({ getMonthlyStats: vi.fn(async () => ({ dailyMinutes: [] })) } as never);
  });

  it('opens rightward from the Review header date, clear of the rail', () => {
    render(<CalendarPopover selectedDate="2026-09-22" align="left" onSelectDate={() => {}} onClose={() => {}} />);
    const popover = screen.getByTestId('calendar-popover');
    expect(popover.className).toContain('left-0');
    expect(popover.className).not.toContain('right-0');
  });

  it('keeps the right-edge anchor by default (the toolbar Move popover)', () => {
    render(<CalendarPopover selectedDate="2026-09-22" onSelectDate={() => {}} onClose={() => {}} />);
    expect(screen.getByTestId('calendar-popover').className).toContain('right-0');
  });
});

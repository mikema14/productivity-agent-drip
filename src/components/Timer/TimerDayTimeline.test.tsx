import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TimerDayTimeline, { DAY_BAR_SEGMENTS, DAY_TARGET_MINUTES } from './TimerDayTimeline';
import { resetTimer } from '../../test/timerState';
import type { PomodoroSession } from '../../types';

vi.mock('../DailyLog/AddEntryModal', () => ({ default: () => null }));

function session(i: number, minutes: number, source: PomodoroSession['source'] = 'pomodoro'): PomodoroSession {
  const d = new Date();
  d.setHours(9 + i, 0, 0, 0);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(9 + i).padStart(2, '0')}:00:00.000`;
  return { id: `s${i}`, start_at: iso, end_at: null, duration_minutes: minutes, task_id: null, source, comment: null, logged: 0, log_sent_at: null, server_entry_id: null, billable: 1 } as PomodoroSession;
}

describe('TimerDayTimeline day bar', () => {
  afterEach(() => resetTimer());

  it('is 12 segments of 30 minutes against a 6h target', () => {
    expect(DAY_BAR_SEGMENTS).toBe(12);
    expect(DAY_TARGET_MINUTES).toBe(360);
  });

  it('fills segments from focus minutes only and labels FOCUS / 6H', () => {
    render(<TimerDayTimeline sessions={[session(0, 90), session(1, 95), session(2, 30, 'break')]} onRefresh={vi.fn()} />);
    const bar = screen.getByTestId('day-bar');
    expect(bar).toHaveAttribute('aria-label', '3 hours 5 minutes of 6 hours');
    expect(bar.children).toHaveLength(12);
    expect(bar.querySelectorAll('[data-filled]')).toHaveLength(6);
    expect(screen.getByText('Focus / 6h')).toBeInTheDocument();
    expect(screen.getByText('3h 05m')).toBeInTheDocument();
  });

  it('shows the amber NOW tag instead of a red line', () => {
    render(<TimerDayTimeline sessions={[]} onRefresh={vi.fn()} />);
    expect(screen.getByText(/^NOW \d{2}:\d{2}$/)).toBeInTheDocument();
    expect(document.querySelector('.bg-red-500')).toBeNull();
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimerDayTimeline, { DAY_BAR_SEGMENTS, DAY_TARGET_MINUTES } from './TimerDayTimeline';
import { resetTimer, setTimer } from '../../test/timerState';
import type { PomodoroSession } from '../../types';

function at(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function session(id: string, hour: number, minute: number, minutes: number, overrides: Partial<PomodoroSession> = {}): PomodoroSession {
  const start = new Date(at(hour, minute));
  return {
    id, start_at: start.toISOString(), end_at: new Date(start.getTime() + minutes * 60_000).toISOString(),
    duration_minutes: minutes, task_id: '667776', source: 'pomodoro', comment: null, logged: 0,
    log_sent_at: null, server_entry_id: null, billable: 1, ...overrides,
  } as PomodoroSession;
}

const run = [
  session('a', 9, 0, 25),
  session('b1', 9, 25, 5, { source: 'break', task_id: null }),
  session('b', 9, 30, 25),
  session('c', 10, 0, 25, { comment: 'error preview and client coms' }),
];

describe('TimerDayTimeline', () => {
  afterEach(() => resetTimer());

  it('keeps the 12 × 30 min / 6h day target exports', () => {
    expect(DAY_BAR_SEGMENTS).toBe(12);
    expect(DAY_TARGET_MINUTES).toBe(360);
  });

  it('has no day bar, week grid, Today key or floating add button', () => {
    render(<TimerDayTimeline sessions={[]} selectedDate={new Date()} />);
    expect(screen.queryByTestId('day-bar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add entry' })).toBeNull();
    expect(screen.queryByText('Focus / 6h')).toBeNull();
  });

  it('marks now with an amber hh:mm chip in the gutter', () => {
    render(<TimerDayTimeline sessions={[]} selectedDate={new Date()} />);
    expect(screen.getByTestId('now-marker')).toHaveTextContent(/^\d{2}:\d{2}$/);
    expect(screen.getByTestId('now-marker')).toHaveClass('bg-focus');
    expect(screen.queryByText(/^NOW /)).toBeNull();
  });

  it('merges back-to-back sessions of one task into one block with a lane; a click expands and folds it', async () => {
    const user = userEvent.setup();
    render(<TimerDayTimeline sessions={run} selectedDate={new Date()} />);
    const block = screen.getByTestId('merged-block');
    expect(block).toHaveAttribute('aria-expanded', 'false');
    expect(within(block).getAllByTestId('lane-segment')).toHaveLength(3);
    expect(block).toHaveTextContent('1h 15m');
    expect(block).toHaveTextContent('error preview and client coms');
    expect(block).toHaveTextContent('3 × 25m · 09:00–10:25');
    // the break inside the run is not drawn
    expect(screen.queryByText('Break')).toBeNull();

    await user.click(block);
    const each = screen.getAllByTestId('expanded-session');
    expect(each).toHaveLength(3);
    expect(screen.queryByTestId('merged-block')).toBeNull();
    await user.click(each[1]);
    expect(screen.getByTestId('merged-block')).toBeInTheDocument();
  });

  it('draws the running session as a dashed block with the time left', () => {
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(), totalDuration: 1500, remainingSeconds: 1435, currentTaskId: '667776', intervalId: 1 });
    render(<TimerDayTimeline sessions={[]} selectedDate={new Date()} />);
    const block = screen.getByTestId('running-block');
    expect(block).toHaveClass('border-dashed');
    expect(block).toHaveTextContent('667776');
    expect(block).toHaveTextContent('23:55 left');
  });
});

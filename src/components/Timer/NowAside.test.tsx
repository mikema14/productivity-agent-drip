import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import NowAside from './NowAside';
import { useLogStore } from '../../stores/logStore';

vi.mock('./TimerDayTimeline', () => ({ default: () => <div>TimelineStub</div> }));
vi.mock('../Lists/TimerTaskList', () => ({ default: () => <div>TaskListStub</div> }));
vi.mock('../DailyLog/AddEntryModal', () => ({ default: () => <div>AddEntryModalStub</div> }));

/**
 * "Review day →" must open the local calendar day. At 00:30 CEST the UTC date
 * is still yesterday, which is what the `toISOString().split('T')[0]` idiom
 * returned; Review's own header uses the local `todayString`.
 */
describe('NowAside — Review day → uses the local date', () => {
  const previousTZ = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = 'Europe/Prague';
    vi.useFakeTimers({ now: new Date(2026, 8, 26, 0, 30, 0) });
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = previousTZ;
  });

  it('at 00:30 local on 26 Sep selects 2026-09-26, not the UTC 25th', () => {
    // Sanity: the fake clock really sits on the previous UTC day.
    expect(new Date().toISOString().split('T')[0]).toBe('2026-09-25');

    const setSelectedDate = vi.fn();
    useLogStore.setState({ setSelectedDate });
    const onNavigate = vi.fn();
    render(
      <NowAside sessions={[]} calendarProposals={[]} adhocEntries={[]} onRefresh={() => {}} onSelectTask={() => {}} onNavigate={onNavigate} />
    );

    fireEvent.click(screen.getByRole('button', { name: /review day/i }));
    expect(setSelectedDate).toHaveBeenCalledWith('2026-09-26');
    expect(onNavigate).toHaveBeenCalledWith('daily-log');
  });
});

describe('NowAside — header, summary, footer', () => {
  const props = { calendarProposals: [], adhocEntries: [], onRefresh: () => {}, onSelectTask: () => {}, onNavigate: () => {} };

  it('one summary line; day nav steps days; no Today key or week grid', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString();
    const sessions = [
      { id: 'a', start_at: start, end_at: null, duration_minutes: 75, task_id: '1', source: 'pomodoro', comment: null, logged: 0, log_sent_at: null, server_entry_id: null, billable: 1 },
      { id: 'b', start_at: start, end_at: null, duration_minutes: 11, task_id: '2', source: 'pomodoro', comment: null, logged: 1, log_sent_at: null, server_entry_id: null, billable: 1 },
      { id: 'c', start_at: start, end_at: null, duration_minutes: 5, task_id: null, source: 'break', comment: null, logged: 0, log_sent_at: null, server_entry_id: null, billable: 1 },
    ] as never;
    render(<NowAside sessions={sessions} {...props} />);
    expect(screen.getByTestId('day-summary')).toHaveTextContent('2 sessions · 1h 26m focus · 1 unlogged');
    expect(screen.getByTestId('aside-day')).toHaveClass('text-focus');
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(screen.getByTestId('aside-day')).toHaveClass('text-txt-secondary');
    expect(screen.getByTestId('day-summary')).toHaveTextContent('0 sessions · 0m focus · 0 unlogged');
  });

  it('the day nav leaves with the Tasks panel; + Entry opens the add-entry modal', () => {
    render(<NowAside sessions={[]} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }));
    expect(screen.queryByRole('button', { name: 'Previous day' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /\+ entry/i }));
    expect(screen.getByText('AddEntryModalStub')).toBeInTheDocument();
  });
});

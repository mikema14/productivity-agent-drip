import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import NowAside from './NowAside';
import { useLogStore } from '../../stores/logStore';

vi.mock('./TimerDayTimeline', () => ({ default: () => <div>TimelineStub</div> }));
vi.mock('../Lists/TimerTaskList', () => ({ default: () => <div>TaskListStub</div> }));

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

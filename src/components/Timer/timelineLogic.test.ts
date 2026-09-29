import { describe, it, expect } from 'vitest';
import { groupTimeline, groupFooter } from './timelineLogic';
import type { PomodoroSession, CalendarProposal, AdhocEntry } from '../../types';

function at(hour: number, minute: number): string {
  return new Date(2026, 8, 28, hour, minute, 0).toISOString();
}

function s(id: string, hour: number, minute: number, minutes: number, taskId: string | null = '1', source: PomodoroSession['source'] = 'pomodoro'): PomodoroSession {
  const start = new Date(at(hour, minute));
  return {
    id, start_at: start.toISOString(), end_at: new Date(start.getTime() + minutes * 60_000).toISOString(),
    duration_minutes: minutes, task_id: taskId, source, comment: null, logged: 0,
    log_sent_at: null, server_entry_id: null, billable: 1,
  } as PomodoroSession;
}

describe('groupTimeline', () => {
  it('merges adjacent sessions of one task across breaks and absorbs those breaks', () => {
    const { groups, groupedSessionIds, absorbedBreakIds } = groupTimeline([
      s('a', 11, 20, 25), s('br', 11, 45, 5, null, 'break'), s('b', 11, 50, 25), s('c', 12, 40, 25), s('late', 14, 0, 5, null, 'break'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].sessions.map(x => x.id)).toEqual(['a', 'b', 'c']);
    expect(groups[0].totalMinutes).toBe(75);
    expect(groupFooter(groups[0])).toBe('3 × 25m · 11:20–13:05');
    expect([...groupedSessionIds].sort()).toEqual(['a', 'b', 'c']);
    expect([...absorbedBreakIds]).toEqual(['br']);
  });

  it('another task, a meeting or a scheduled entry in between splits the run; singles and id-less sessions never group', () => {
    const meeting = { id: 'm', start_at: at(10, 0), date: '2026-09-28' } as CalendarProposal;
    const entry = { id: 'e', start_time: at(13, 0), date: '2026-09-28' } as AdhocEntry;
    const { groups } = groupTimeline(
      [s('a', 9, 0, 25), s('b', 9, 30, 25), s('c', 10, 30, 25), s('d', 11, 0, 25, '2'), s('e1', 12, 0, 25), s('e2', 13, 30, 25), s('n1', 15, 0, 25, null), s('n2', 15, 30, 25, null)],
      [meeting],
      [entry]
    );
    expect(groups.map(g => g.sessions.map(x => x.id))).toEqual([['a', 'b']]);
  });

  it('labels mixed lengths by count', () => {
    const { groups } = groupTimeline([s('a', 9, 0, 25), s('b', 9, 30, 50)]);
    expect(groupFooter(groups[0])).toBe('2 sessions · 09:00–10:20');
  });
});

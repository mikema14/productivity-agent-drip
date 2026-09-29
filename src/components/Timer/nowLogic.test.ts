import { describe, it, expect } from 'vitest';
import { focusReadouts, minutesByTask, upNextRows } from './nowLogic';
import type { PlannedRow } from '../Plan/boardLogic';
import type { PomodoroSession } from '../../types';

function s(id: string, minutes: number, taskId: string | null, source: PomodoroSession['source'] = 'pomodoro'): PomodoroSession {
  return {
    id, start_at: '2026-09-28T09:00:00.000', end_at: null, duration_minutes: minutes, task_id: taskId, source,
    comment: null, logged: 0, log_sent_at: null, server_entry_id: null, billable: 1,
  } as PomodoroSession;
}

function row(itemId: string, taskId: string | null, column: PlannedRow['column'] = 'today'): PlannedRow {
  return { itemId, taskId, title: `Item ${itemId}`, column, listName: 'L', listColor: '#fff' };
}

describe('focusReadouts', () => {
  it('adds the running session to today, the session number and this task; breaks never count', () => {
    const r = focusReadouts([s('a', 25, '1'), s('b', 50, '1'), s('c', 11, '2'), s('d', 10, null, 'break')], '1', 659);
    expect(r.todayMinutes).toBe(96);
    expect(r.completedSessions).toBe(3);
    expect(r.task).toEqual({ minutes: 85, sessions: 3 });
    expect(r.filledSegments).toBe(3);
  });

  it('no task: no task readout; the bar never exceeds 12 segments', () => {
    const r = focusReadouts([s('a', 500, '1')], null, 0);
    expect(r.task).toBeNull();
    expect(r.filledSegments).toBe(12);
  });
});

describe('minutesByTask', () => {
  it('sums focus minutes per task, skipping breaks and id-less rows', () => {
    expect(minutesByTask([s('a', 25, '1'), s('b', 5, '1'), s('c', 30, null), s('d', 5, '1', 'break')])).toEqual({ '1': 30 });
  });
});

describe('upNextRows', () => {
  it('Today only, the running task removed, Today positions kept, two rows', () => {
    const planned = [row('a', '100'), row('b', '200'), row('c', null), row('d', '400'), row('w', '500', 'this_week')];
    expect(upNextRows(planned, '100').map(r => [r.itemId, r.index])).toEqual([['b', 2], ['c', 3]]);
    expect(upNextRows(planned, '200').map(r => r.itemId)).toEqual(['a', 'c']);
    expect(upNextRows(planned, null, 5).map(r => r.itemId)).toEqual(['a', 'b', 'c', 'd']);
  });
});

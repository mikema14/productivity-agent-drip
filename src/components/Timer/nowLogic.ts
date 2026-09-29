import type { PomodoroSession } from '../../types';
import type { PlannedRow } from '../Plan/boardLogic';
import { DAY_BAR_SEGMENTS, DAY_TARGET_MINUTES } from './TimerDayTimeline';

/** The running card's right column: today's focus, the session number and time on this task. */
export interface FocusReadouts {
  /** Today's focus minutes, the running session's elapsed minutes included. */
  todayMinutes: number;
  /** Day bar segments lit (of DAY_BAR_SEGMENTS) against the 6h target. */
  filledSegments: number;
  /** Focus sessions already saved today; the running one is `completedSessions + 1`. */
  completedSessions: number;
  /** Null without a task. Both include the running session. */
  task: { minutes: number; sessions: number } | null;
}

export function focusReadouts(
  sessions: PomodoroSession[],
  currentTaskId: string | null,
  elapsedSeconds: number
): FocusReadouts {
  const focus = sessions.filter(s => s.source !== 'break');
  const elapsedMinutes = Math.floor(Math.max(0, elapsedSeconds) / 60);
  const todayMinutes = focus.reduce((sum, s) => sum + s.duration_minutes, 0) + elapsedMinutes;
  const filledSegments = Math.min(DAY_BAR_SEGMENTS, Math.round((todayMinutes / DAY_TARGET_MINUTES) * DAY_BAR_SEGMENTS));

  let task: FocusReadouts['task'] = null;
  if (currentTaskId) {
    const onTask = focus.filter(s => s.task_id === currentTaskId);
    task = {
      minutes: onTask.reduce((sum, s) => sum + s.duration_minutes, 0) + elapsedMinutes,
      sessions: onTask.length + 1,
    };
  }

  return { todayMinutes, filledSegments, completedSessions: focus.length, task };
}

/** Focus minutes per task id from today's rows (Up next's tracked-today column). */
export function minutesByTask(sessions: PomodoroSession[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sessions) {
    if (s.source === 'break' || !s.task_id) continue;
    out[s.task_id] = (out[s.task_id] ?? 0) + s.duration_minutes;
  }
  return out;
}

export interface UpNextRow extends PlannedRow {
  /** 1-based position in Plan's Today column (the running task keeps its number). */
  index: number;
}

/** Up next under the running card: Today's open items minus the running task, first `limit`. */
export function upNextRows(planned: PlannedRow[], currentTaskId: string | null, limit = 2): UpNextRow[] {
  return planned
    .filter(r => r.column === 'today')
    .map((r, i) => ({ ...r, index: i + 1 }))
    .filter(r => !(currentTaskId && r.taskId === currentTaskId))
    .slice(0, limit);
}

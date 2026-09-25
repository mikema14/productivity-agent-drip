import type { TaskCache, RankedTask } from '../types';
import { parseDbTimestamp } from './time';

/** Only work from the last N days counts toward a task's score. */
export const FRECENCY_WINDOW_DAYS = 30;
/** Decay time constant in days (see scoreTaskUsage). */
export const FRECENCY_DECAY_DAYS = 7;

const DAY_MS = 86_400_000;

/**
 * One piece of tracked work on a task, fetched raw from the DB: a non-break
 * pomodoro session, an adhoc entry, or an accepted calendar proposal.
 */
export interface TaskUsageRow {
  task_id: string;
  /** When the work happened: ISO string, SQLite datetime, or YYYY-MM-DD. */
  at: string;
  /** The YYYY-MM-DD day the row belongs to, by the same rule the Daily Log uses for its table. */
  day: string;
  minutes: number;
}

interface TaskScore {
  score: number;
  lastUsedAt: number;
}

/**
 * Frecency score per task: every usage row inside the window adds
 * exp(-ageDays / 7), so work from today is worth 1, a week ago ~0.37, two
 * weeks ago ~0.14, and anything older than 30 days nothing. Five sessions last
 * week therefore outrank one session this morning.
 */
export function scoreTaskUsage(rows: TaskUsageRow[], now: number): Map<string, TaskScore> {
  const scores = new Map<string, TaskScore>();
  for (const row of rows) {
    const at = parseDbTimestamp(row.at);
    if (Number.isNaN(at)) continue;
    const ageDays = Math.max(0, (now - at) / DAY_MS);
    if (ageDays > FRECENCY_WINDOW_DAYS) continue;
    const prev = scores.get(row.task_id) ?? { score: 0, lastUsedAt: 0 };
    scores.set(row.task_id, {
      score: prev.score + Math.exp(-ageDays / FRECENCY_DECAY_DAYS),
      lastUsedAt: Math.max(prev.lastUsedAt, at),
    });
  }
  return scores;
}

/** Sum of tracked minutes per task for one day. */
export function sumMinutesForDay(rows: TaskUsageRow[], day: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.day !== day) continue;
    totals.set(row.task_id, (totals.get(row.task_id) ?? 0) + (row.minutes || 0));
  }
  return totals;
}

const SCORE_EPSILON = 1e-9;

function lastSeen(task: TaskCache): number {
  const t = parseDbTimestamp(task.last_seen_at ?? '');
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Order cached tasks for the picker: tasks with usage in the window first, by
 * score (ties go to the most recently used), then everything else by
 * last_seen_at. Each result carries its tracked minutes for `today`.
 */
export function rankTasks(
  tasks: TaskCache[],
  rows: TaskUsageRow[],
  opts: { now: number; today: string; limit: number }
): RankedTask[] {
  const scores = scoreTaskUsage(rows, opts.now);
  const todayMinutes = sumMinutesForDay(rows, opts.today);

  const decorated = tasks.map(task => ({
    task,
    score: scores.get(task.task_id)?.score ?? 0,
    lastUsedAt: scores.get(task.task_id)?.lastUsedAt ?? 0,
    lastSeenAt: lastSeen(task),
  }));

  decorated.sort((a, b) => {
    const aScored = a.score > 0;
    const bScored = b.score > 0;
    if (aScored !== bScored) return aScored ? -1 : 1;
    if (aScored && Math.abs(b.score - a.score) > SCORE_EPSILON) return b.score - a.score;
    if (b.lastUsedAt !== a.lastUsedAt) return b.lastUsedAt - a.lastUsedAt;
    if (b.lastSeenAt !== a.lastSeenAt) return b.lastSeenAt - a.lastSeenAt;
    return a.task.task_id.localeCompare(b.task.task_id);
  });

  return decorated.slice(0, opts.limit).map(({ task }) => ({
    ...task,
    todayMinutes: todayMinutes.get(task.task_id) ?? 0,
  }));
}

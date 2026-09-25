import { describe, it, expect } from 'vitest';
import { rankTasks, scoreTaskUsage, sumMinutesForDay, type TaskUsageRow } from './frecency';
import type { TaskCache } from '../types';

const NOW = Date.parse('2026-09-25T12:00:00.000Z');
const TODAY = '2026-09-25';
const DAY = 86_400_000;

function task(id: string, lastSeenDaysAgo = 0): TaskCache {
  const d = new Date(NOW - lastSeenDaysAgo * DAY);
  // SQLite datetime('now') format: UTC without a zone marker
  const lastSeen = d.toISOString().replace('T', ' ').slice(0, 19);
  return { task_id: id, title: `Task ${id}`, project_id: 1, project_name: 'P', last_seen_at: lastSeen };
}

function use(id: string, daysAgo: number, minutes = 25): TaskUsageRow {
  const at = new Date(NOW - daysAgo * DAY).toISOString();
  return { task_id: id, at, day: at.slice(0, 10), minutes };
}

const rank = (tasks: TaskCache[], rows: TaskUsageRow[], limit = 20) =>
  rankTasks(tasks, rows, { now: NOW, today: TODAY, limit }).map(t => t.task_id);

describe('scoreTaskUsage', () => {
  it('decays with exp(-ageDays / 7)', () => {
    const scores = scoreTaskUsage([use('a', 0), use('b', 7), use('c', 14)], NOW);
    expect(scores.get('a')!.score).toBeCloseTo(1, 6);
    expect(scores.get('b')!.score).toBeCloseTo(Math.exp(-1), 6);
    expect(scores.get('c')!.score).toBeCloseTo(Math.exp(-2), 6);
  });

  it('ignores usage older than the 30-day window', () => {
    const scores = scoreTaskUsage([use('old', 31), use('edge', 29)], NOW);
    expect(scores.has('old')).toBe(false);
    expect(scores.get('edge')!.score).toBeGreaterThan(0);
  });
});

describe('rankTasks', () => {
  it('ranks a frequently used task above a single recent use within the window', () => {
    const rows = [
      use('frequent', 5), use('frequent', 5.1), use('frequent', 6), use('frequent', 6.2), use('frequent', 7),
      use('recent', 0),
    ];
    expect(rank([task('recent'), task('frequent')], rows)).toEqual(['frequent', 'recent']);
  });

  it('lets a recent single use beat the same count of older uses (decay)', () => {
    expect(rank([task('older'), task('newer')], [use('older', 10), use('newer', 1)])).toEqual(['newer', 'older']);
  });

  it('puts tasks without usage after scored ones, ordered by last_seen_at', () => {
    const tasks = [task('none-new', 0), task('scored', 20), task('none-old', 3)];
    // "scored" was last seen long ago but has one session 25 days back; it still leads
    expect(rank(tasks, [use('scored', 25)])).toEqual(['scored', 'none-new', 'none-old']);
  });

  it('breaks score ties by most recent use, then last_seen_at, then id', () => {
    // Same score for x and y (one session each at the same age) -> identical lastUsedAt too,
    // so last_seen_at decides.
    const tied = rank([task('x', 5), task('y', 1)], [use('x', 2), use('y', 2)]);
    expect(tied).toEqual(['y', 'x']);

    // Everything equal -> stable by id
    expect(rank([task('b'), task('a')], [])).toEqual(['a', 'b']);
  });

  it('respects the limit', () => {
    const tasks = Array.from({ length: 30 }, (_, i) => task(`t${i}`, i));
    expect(rank(tasks, [], 20)).toHaveLength(20);
  });

  it("attaches today's minutes to each task", () => {
    const rows = [use('a', 0, 25), use('a', 0.1, 50), use('a', 1, 25), use('b', 3, 10)];
    const ranked = rankTasks([task('a'), task('b')], rows, { now: NOW, today: TODAY, limit: 20 });
    expect(ranked.find(t => t.task_id === 'a')!.todayMinutes).toBe(75);
    expect(ranked.find(t => t.task_id === 'b')!.todayMinutes).toBe(0);
  });
});

describe('sumMinutesForDay', () => {
  it('sums only rows whose day matches, across sources', () => {
    const rows: TaskUsageRow[] = [
      { task_id: 'a', at: '2026-09-25T08:00:00.000Z', day: '2026-09-25', minutes: 25 }, // session
      { task_id: 'a', at: '2026-09-25', day: '2026-09-25', minutes: 30 },               // adhoc, no start time
      { task_id: 'a', at: '2026-09-24T08:00:00.000Z', day: '2026-09-24', minutes: 60 }, // yesterday
      { task_id: 'b', at: '2026-09-25T09:00:00.000Z', day: '2026-09-25', minutes: 45 }, // calendar
    ];
    const totals = sumMinutesForDay(rows, '2026-09-25');
    expect(totals.get('a')).toBe(55);
    expect(totals.get('b')).toBe(45);
    expect(totals.has('c')).toBe(false);
  });
});

import type { RankedTask } from '../types';

export function makeTask(i: number, overrides: Partial<RankedTask> = {}): RankedTask {
  return {
    task_id: String(600000 + i),
    title: `Task number ${i}`,
    project_id: 1000 + i,
    project_name: `Project ${i}`,
    last_seen_at: new Date(Date.now() - i * 3_600_000).toISOString(),
    todayMinutes: 0,
    ...overrides,
  };
}

export function makeTasks(n: number): RankedTask[] {
  return Array.from({ length: n }, (_, i) => makeTask(i + 1));
}

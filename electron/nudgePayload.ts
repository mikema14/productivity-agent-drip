import type { IdleNudgePayload } from '../src/types';
import type { IdleConfig } from './idleWatcher';

/**
 * Builds the idle nudge's payload from the watcher's `show-nudge` action.
 *
 * Pure: the DB and Raycast reads come in as `lookup` callbacks, so this can be
 * unit-tested without Electron and any failure degrades to the task-less copy
 * instead of blocking the nudge (PHASE4_PLAN.md N4).
 */
export interface NudgeLookup {
  /** Task id of today's most recent session with a task, if any. */
  lastTask: () => string | null | undefined;
  /** Cached title for a task id, if any. */
  taskTitle: (taskId: string) => string | null | undefined;
  /** Whether Raycast Focus would start with the kickoff. */
  raycastFocus: () => boolean;
}

function safe<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

export function buildNudgePayload(
  action: { idleSince: number; kickoffAt: number },
  cfg: Pick<IdleConfig, 'kickoffSeconds' | 'snoozeMs' | 'snoozeLongMs' | 'escalateAfterMs'>,
  lookup: NudgeLookup
): IdleNudgePayload {
  const taskId = safe(() => lookup.lastTask(), null) || null;
  const taskTitle = taskId ? safe(() => lookup.taskTitle(taskId), null) || null : null;
  return {
    kind: 'idle',
    idleSince: new Date(action.idleSince).toISOString(),
    kickoffAt: new Date(action.kickoffAt).toISOString(),
    kickoffSeconds: cfg.kickoffSeconds,
    snoozeSeconds: Math.round(cfg.snoozeMs / 1000),
    snoozeLongSeconds: Math.round(cfg.snoozeLongMs / 1000),
    escalateMinutes: Math.round(cfg.escalateAfterMs / 60000),
    taskId,
    taskTitle,
    raycastFocus: safe(() => lookup.raycastFocus() === true, false),
  };
}

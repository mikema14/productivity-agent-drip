import type { IdleNudgePayload } from '../types';
import { pad, span } from './parts';

/**
 * The idle nudge's words, kept pure so every shape is unit-tested
 * (PHASE4_PLAN.md §3.3). Times are ISO strings from main; `nowMs` is the
 * renderer's 1 s wall clock.
 */

/** `14:32` until the automatic kickoff, floored at `0:00`. Seconds under DRIP_IDLE_FAST work the same way. */
export function takeoverIn(kickoffAtIso: string, nowMs: number): string {
  const left = Math.max(0, Math.round((Date.parse(kickoffAtIso) - nowMs) / 1000));
  return `${Math.floor(left / 60)}:${pad(left % 60)}`;
}

/** `12m` since the idle clock started (`40s` below a minute). */
export function idleFor(idleSinceIso: string, nowMs: number): string {
  return span((nowMs - Date.parse(idleSinceIso)) / 1000);
}

/** `2-minute` for 120 s; `20-second` for 20 s; `90-second` for anything that is not whole minutes. */
export function kickoffLength(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s >= 60 && s % 60 === 0) return `${s / 60}-minute`;
  return `${s}-second`;
}

export interface Explanation {
  before: string;
  /** Rendered as its own amber mono span (never a `#`); null when the sentence names no id. */
  taskId: string | null;
  after: string;
}

/**
 * What happens if the nudge is ignored — four shapes (N4):
 *   Raycast + task   → Then Raycast Focus turns on and a 2-minute kickoff starts on 689742.
 *   no Raycast       → Then a 2-minute kickoff starts on 689742.
 *   no task          → … starts on your last task.
 *   neither          → Then a 2-minute kickoff starts.
 */
export function explain(payload: Pick<IdleNudgePayload, 'kickoffSeconds' | 'taskId' | 'raycastFocus'>): Explanation {
  const kickoff = `a ${kickoffLength(payload.kickoffSeconds)} kickoff starts`;
  const lead = payload.raycastFocus ? `Then Raycast Focus turns on and ${kickoff}` : `Then ${kickoff}`;
  if (payload.taskId) return { before: `${lead} on `, taskId: payload.taskId, after: '.' };
  if (payload.raycastFocus) return { before: `${lead} on your last task.`, taskId: null, after: '' };
  return { before: `${lead}.`, taskId: null, after: '' };
}

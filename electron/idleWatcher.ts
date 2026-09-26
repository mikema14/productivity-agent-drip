/**
 * Idle nudge → kickoff decision logic.
 *
 * Pure and dependency-free (no Electron, no DB) so it can be unit-tested with a
 * fake clock. electron/idleNudge.ts feeds it timer events and a poll every
 * ~30s, and carries out the actions it returns.
 *
 * Timeline, generic idle (nothing running, focus finished, timer stopped):
 *   0            idle clock starts
 *   nudgeAfter   red nudge            (10 min)
 *   +escalate    kickoff starts       (15 min after the nudge → 25 min)
 *
 * Timeline, break end — the green "Break over" card is itself the nudge:
 *   0            break ends, green card
 *   nudgeAfter   red nudge replaces it (10 min)
 *   escalate     kickoff starts        (15 min after the break ended)
 *
 * Any gate (toggle off, away, locked/asleep, outside work hours, in a meeting)
 * drops the clock; it restarts from zero once the gate lifts. Dismissing the
 * nudge does not touch the state: an ignored nudge still escalates.
 *
 * A pause (Snooze 15m / 1h / Rest of day on the card, "Pause nudges" in the
 * menu bar) holds nudge and escalation until it runs out, survives the gates,
 * and then hands over to a fresh idle clock — never a nudge on expiry. Only a
 * running focus/break or an explicit Resume ends it early.
 */

import type { SnoozeChoice } from '../src/types';

export type TimerStatus = 'idle' | 'focus' | 'break';

export interface IdleConfig {
  /** Idle time before the red nudge. */
  nudgeAfterMs: number;
  /** Nudge ignored this long → kickoff. */
  escalateAfterMs: number;
  /** The short pause (the card's first choice). */
  snoozeMs: number;
  /** The long pause (the card's second choice). */
  snoozeLongMs: number;
  /** System input idle time at which the user counts as away from the Mac. */
  awayAfterSec: number;
  /** Days nudges may fire, 0 = Sunday. */
  workDays: readonly number[];
  /** Work hours, minutes after local midnight; end is exclusive. */
  workStartMin: number;
  workEndMin: number;
  /** Length of the kickoff session before it rolls into a full focus session. */
  kickoffSeconds: number;
  /** How long the "Keep going / Stop" prompt stays up at the end of a kickoff. */
  kickoffPromptSeconds: number;
  /** Poll interval of the wiring layer. */
  pollMs: number;
}

const MIN = 60_000;

/** The one place the numbers live. */
export const IDLE_DEFAULTS: IdleConfig = {
  nudgeAfterMs: 10 * MIN,
  escalateAfterMs: 15 * MIN,
  snoozeMs: 15 * MIN,
  snoozeLongMs: 60 * MIN,
  awayAfterSec: 120,
  workDays: [1, 2, 3, 4, 5],
  workStartMin: 8 * 60,
  workEndMin: 18 * 60,
  kickoffSeconds: 120,
  kickoffPromptSeconds: 10,
  pollMs: 30_000,
};

/**
 * DRIP_IDLE_FAST=1: minutes become seconds, for manual QA. Also ignores work
 * hours so it can be tried in the evening or at the weekend.
 */
export const IDLE_FAST: IdleConfig = {
  ...IDLE_DEFAULTS,
  nudgeAfterMs: 20_000,
  escalateAfterMs: 30_000,
  snoozeMs: 30_000,
  snoozeLongMs: 60_000,
  workDays: [0, 1, 2, 3, 4, 5, 6],
  workStartMin: 0,
  workEndMin: 24 * 60,
  kickoffSeconds: 20,
  pollMs: 5_000,
};

export type IdlePhase =
  /** No clock running: timer busy, or a gate is down. */
  | 'off'
  /** Timer idle, counting towards the nudge. */
  | 'counting'
  /** Red nudge raised, counting towards the kickoff. */
  | 'nudged'
  /** Paused by the user; a fresh idle clock starts at snoozeUntil. */
  | 'snoozed';

export interface IdleState {
  phase: IdlePhase;
  /** When the current idle clock started (epoch ms); null while 'off'. */
  since: number | null;
  /** Escalation counts from here: the red nudge, or the break end. */
  nudgeAt: number | null;
  /** End of the pause (epoch ms); set only while 'snoozed'. */
  snoozeUntil: number | null;
  origin: 'idle' | 'break-end';
}

export interface IdleInputs {
  timerStatus: TimerStatus;
  /** powerMonitor.getSystemIdleTime() */
  systemIdleSec: number;
  /** Settings master toggle. */
  enabled: boolean;
  /** A calendar event is running right now. */
  inMeeting: boolean;
  /** Screen locked or the Mac asleep. */
  locked: boolean;
}

export type IdleAction =
  | { type: 'none' }
  | { type: 'show-nudge'; idleSince: number; kickoffAt: number }
  | { type: 'hide-nudge' }
  | { type: 'kickoff' };

export type GateReason = 'disabled' | 'locked' | 'away' | 'off-hours' | 'meeting';

const NONE: IdleAction = { type: 'none' };

export const INITIAL_IDLE_STATE: IdleState = {
  phase: 'off',
  since: null,
  nudgeAt: null,
  snoozeUntil: null,
  origin: 'idle',
};

function off(): IdleState {
  return { ...INITIAL_IDLE_STATE };
}

function counting(now: number, origin: IdleState['origin']): IdleState {
  return {
    phase: 'counting',
    since: now,
    // On the break-end path the green card already is the nudge.
    nudgeAt: origin === 'break-end' ? now : null,
    snoozeUntil: null,
    origin,
  };
}

/** Leaving the nudged phase means the red card has to come down. */
function leave(state: IdleState, next: IdleState): { state: IdleState; action: IdleAction } {
  return { state: next, action: state.phase === 'nudged' ? { type: 'hide-nudge' } : NONE };
}

export function isWithinWorkHours(now: number, cfg: IdleConfig = IDLE_DEFAULTS): boolean {
  const d = new Date(now);
  if (!cfg.workDays.includes(d.getDay())) return false;
  const minutes = d.getHours() * 60 + d.getMinutes();
  return minutes >= cfg.workStartMin && minutes < cfg.workEndMin;
}

export function gateReason(inputs: IdleInputs, now: number, cfg: IdleConfig = IDLE_DEFAULTS): GateReason | null {
  if (!inputs.enabled) return 'disabled';
  if (inputs.locked) return 'locked';
  if (inputs.systemIdleSec >= cfg.awayAfterSec) return 'away';
  if (!isWithinWorkHours(now, cfg)) return 'off-hours';
  if (inputs.inMeeting) return 'meeting';
  return null;
}

/** The poll step. */
export function nextIdleAction(
  state: IdleState,
  inputs: IdleInputs,
  now: number,
  cfg: IdleConfig = IDLE_DEFAULTS
): { state: IdleState; action: IdleAction } {
  // Backstop for a missed timer event: a running focus or break is never idle.
  if (inputs.timerStatus !== 'idle') return leave(state, off());

  // A pause outlives the gates: leaving the Mac for a call must not shorten it.
  if (state.phase === 'snoozed' && state.snoozeUntil !== null && now < state.snoozeUntil) {
    return { state, action: NONE };
  }

  if (gateReason(inputs, now, cfg)) return leave(state, off());

  switch (state.phase) {
    case 'off':
    case 'snoozed':
      // First ungated idle poll (launch, gate lifted) or the pause ran out:
      // the clock starts now. No nudge on expiry.
      return { state: counting(now, 'idle'), action: NONE };

    case 'counting':
      if (state.since !== null && now - state.since >= cfg.nudgeAfterMs) return raise(state, now, cfg);
      return { state, action: NONE };

    case 'nudged':
      if (state.nudgeAt !== null && now - state.nudgeAt >= cfg.escalateAfterMs) {
        return { state: off(), action: { type: 'kickoff' } };
      }
      return { state, action: NONE };
  }
}

function raise(state: IdleState, now: number, cfg: IdleConfig): { state: IdleState; action: IdleAction } {
  // Break-end: escalation already counts from the break end (the green card).
  const nudgeAt = state.origin === 'break-end' && state.nudgeAt !== null ? state.nudgeAt : now;
  const since = state.since ?? now;
  return {
    state: { ...state, phase: 'nudged', since, nudgeAt, snoozeUntil: null },
    action: { type: 'show-nudge', idleSince: since, kickoffAt: nudgeAt + cfg.escalateAfterMs },
  };
}

/**
 * The main-process timer changed status. Focus/break starting stops the clock;
 * the timer going idle starts it, on the break-end path if a break just ended.
 */
export function onTimerStatus(
  state: IdleState,
  status: TimerStatus,
  previous: TimerStatus,
  now: number
): { state: IdleState; action: IdleAction } {
  if (status !== 'idle') return leave(state, off());
  if (previous === 'idle') return { state, action: NONE };
  return leave(state, counting(now, previous === 'break' ? 'break-end' : 'idle'));
}

/** Local midnight of the day `now` falls in, plus `minutes`. */
function localDayAt(now: number, minutes: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime() + minutes * MIN;
}

/**
 * When a pause of the given kind ends. `day` = the end of today's work hours
 * (past it already: the end of the local day), so with the off-hours gate the
 * next nudge can only come on the next workday.
 */
export function snoozeUntilFor(choice: SnoozeChoice, now: number, cfg: IdleConfig = IDLE_DEFAULTS): number {
  switch (choice) {
    case '15m':
      return now + cfg.snoozeMs;
    case '1h':
      return now + cfg.snoozeLongMs;
    case 'day': {
      const workEnd = localDayAt(now, cfg.workEndMin);
      return workEnd > now ? workEnd : localDayAt(now, 24 * 60);
    }
  }
}

/**
 * Pause until `untilMs`: no nudge and no escalation until then. The clock
 * restarts from zero when the pause runs out (see nextIdleAction). A pause
 * that is already over is the same as a fresh clock.
 */
export function onSnooze(state: IdleState, now: number, untilMs: number): IdleState {
  if (untilMs <= now) return counting(now, 'idle');
  return {
    phase: 'snoozed',
    since: null,
    nudgeAt: null,
    snoozeUntil: untilMs,
    origin: 'idle',
  };
}

/** Resume: the pause ends now and a fresh idle clock starts. No-op when not paused. */
export function onResume(state: IdleState, now: number): IdleState {
  return state.phase === 'snoozed' ? counting(now, 'idle') : state;
}

/** End of the current pause, or null. */
export function pausedUntil(state: IdleState): number | null {
  return state.phase === 'snoozed' ? state.snoozeUntil : null;
}

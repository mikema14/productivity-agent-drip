/**
 * Kickoff: a short focus session that rolls straight into a full one.
 *
 * Pure, so the roll-over rule can be tested without Electron. timer.ts runs a
 * kickoff as ONE focus session: it counts down the kickoff seconds, then
 * extends itself by the full focus length at zero instead of completing. So
 * the kickoff minutes count toward the session, and the Raycast Focus session
 * (started for kickoff + focus length) never needs a restart.
 */

export interface CountdownState {
  remainingSeconds: number;
  totalDuration: number;
  /** Seconds to extend by at zero; 0 once rolled over or for a normal session. */
  rolloverSeconds: number;
}

export type CountdownZero =
  | { type: 'rollover'; next: CountdownState }
  | { type: 'complete' };

/** What happens when the countdown reaches zero. */
export function atCountdownZero(state: CountdownState): CountdownZero {
  if (state.rolloverSeconds <= 0) return { type: 'complete' };
  return {
    type: 'rollover',
    next: {
      remainingSeconds: state.rolloverSeconds,
      totalDuration: state.totalDuration + state.rolloverSeconds,
      rolloverSeconds: 0,
    },
  };
}

/** Raycast Focus has to cover everything still to come, roll-over included. */
export function raycastSecondsFor(state: Pick<CountdownState, 'remainingSeconds' | 'rolloverSeconds'>): number {
  return state.remainingSeconds + Math.max(0, state.rolloverSeconds);
}

/** The prompt shown when the kickoff rolls over: [Keep going] [Stop]. */
export type KickoffPromptOutcome = 'keep-going' | 'stop' | 'timeout';

export interface KickoffPromptResult {
  /** The (already rolled-over) session keeps running. */
  continueSession: boolean;
  /** Stop the session and record what ran as a kickoff session. */
  stopSession: boolean;
  /** End the Raycast Focus session Drip started. */
  endRaycast: boolean;
}

/** No answer counts as "keep going": the takeover only works if it's the default. */
export function resolveKickoffPrompt(outcome: KickoffPromptOutcome): KickoffPromptResult {
  if (outcome === 'stop') return { continueSession: false, stopSession: true, endRaycast: true };
  return { continueSession: true, stopSession: false, endRaycast: false };
}

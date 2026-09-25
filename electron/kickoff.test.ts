import { describe, expect, it } from 'vitest';
import {
  atCountdownZero,
  raycastSecondsFor,
  resolveKickoffPrompt,
  type CountdownState,
} from './kickoff';

const FOCUS = 25 * 60;
const KICKOFF = 120;

/** What timer.ts does each second: decrement, and consult atCountdownZero at zero. */
function runSeconds(state: CountdownState, seconds: number): { state: CountdownState; completed: boolean } {
  for (let i = 0; i < seconds; i++) {
    if (state.remainingSeconds <= 0) {
      const zero = atCountdownZero(state);
      if (zero.type === 'complete') return { state, completed: true };
      state = zero.next;
      continue;
    }
    state = { ...state, remainingSeconds: state.remainingSeconds - 1 };
  }
  return { state, completed: false };
}

describe('kickoff roll-over', () => {
  const kickoff: CountdownState = { remainingSeconds: KICKOFF, totalDuration: KICKOFF, rolloverSeconds: FOCUS };

  it('with no action, continues into the full focus session as the same session', () => {
    // 120 ticks to zero, one more rolls over
    const { state, completed } = runSeconds(kickoff, KICKOFF + 1);
    expect(completed).toBe(false);
    expect(state).toEqual({ remainingSeconds: FOCUS, totalDuration: KICKOFF + FOCUS, rolloverSeconds: 0 });

    // No prompt answer = keep going
    expect(resolveKickoffPrompt('timeout')).toEqual({ continueSession: true, stopSession: false, endRaycast: false });
    expect(resolveKickoffPrompt('keep-going').continueSession).toBe(true);

    // ...and the rolled-over session completes normally at the end
    expect(runSeconds(state, FOCUS + 1).completed).toBe(true);
  });

  it('Stop ends the session and ends Raycast Focus', () => {
    expect(resolveKickoffPrompt('stop')).toEqual({ continueSession: false, stopSession: true, endRaycast: true });
  });

  it('a normal focus session completes at zero', () => {
    expect(atCountdownZero({ remainingSeconds: 0, totalDuration: FOCUS, rolloverSeconds: 0 })).toEqual({ type: 'complete' });
  });

  it('starts Raycast for kickoff + focus length, so rolling over needs no restart', () => {
    expect(raycastSecondsFor(kickoff)).toBe(KICKOFF + FOCUS);
    // Resuming after a pause in the kickoff still covers the roll-over
    expect(raycastSecondsFor({ remainingSeconds: 50, rolloverSeconds: FOCUS })).toBe(50 + FOCUS);
    expect(raycastSecondsFor({ remainingSeconds: 600, rolloverSeconds: 0 })).toBe(600);
  });
});

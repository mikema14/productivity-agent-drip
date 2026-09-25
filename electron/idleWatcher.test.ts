import { describe, expect, it } from 'vitest';
import {
  IDLE_DEFAULTS,
  INITIAL_IDLE_STATE,
  nextIdleAction,
  onSnooze,
  onTimerStatus,
  type IdleAction,
  type IdleInputs,
  type IdleState,
} from './idleWatcher';

const MIN = 60_000;
/** Wednesday 23 Sep 2026, 10:00 local. */
const WED_10 = new Date(2026, 8, 23, 10, 0).getTime();
/** Saturday 26 Sep 2026, 10:00 local. */
const SAT_10 = new Date(2026, 8, 26, 10, 0).getTime();

const PRESENT: IdleInputs = {
  timerStatus: 'idle',
  systemIdleSec: 5,
  enabled: true,
  inMeeting: false,
  locked: false,
};

/**
 * Drives the machine like the wiring does: a poll every 30s from `from` to
 * `to`, with the inputs `at(t)` returns. Collects every non-'none' action.
 */
function run(
  state: IdleState,
  from: number,
  to: number,
  at: (t: number) => IdleInputs = () => PRESENT
): { state: IdleState; actions: Array<{ t: number; action: IdleAction }> } {
  const actions: Array<{ t: number; action: IdleAction }> = [];
  for (let t = from; t <= to; t += 30_000) {
    const result = nextIdleAction(state, at(t), t);
    state = result.state;
    if (result.action.type !== 'none') actions.push({ t, action: result.action });
  }
  return { state, actions };
}

/** Timer went idle at `t` after a focus session (generic path). */
function idleAt(t: number): IdleState {
  return onTimerStatus(INITIAL_IDLE_STATE, 'idle', 'focus', t).state;
}

function types(actions: Array<{ action: IdleAction }>): string[] {
  return actions.map((a) => a.action.type);
}

describe('idle nudge', () => {
  it('does not nudge before 10 minutes', () => {
    const { actions } = run(idleAt(WED_10), WED_10, WED_10 + 9.5 * MIN);
    expect(actions).toEqual([]);
  });

  it('nudges at 10 minutes when present, in work hours, toggle on', () => {
    const { actions } = run(idleAt(WED_10), WED_10, WED_10 + 10 * MIN);
    expect(actions).toHaveLength(1);
    expect(actions[0].t).toBe(WED_10 + 10 * MIN);
    expect(actions[0].action).toEqual({
      type: 'show-nudge',
      idleSince: WED_10,
      kickoffAt: WED_10 + 25 * MIN,
    });
  });

  it('starts the clock on the first idle poll when no timer event was seen (app launch)', () => {
    const { actions } = run(INITIAL_IDLE_STATE, WED_10, WED_10 + 10 * MIN);
    expect(actions).toEqual([{ t: WED_10 + 10 * MIN, action: expect.objectContaining({ type: 'show-nudge' }) }]);
  });

  it.each<[string, Partial<IdleInputs>]>([
    ['away (system idle over 120s)', { systemIdleSec: 121 }],
    ['the toggle is off', { enabled: false }],
    ['in a calendar event', { inMeeting: true }],
    ['the screen is locked', { locked: true }],
    ['a focus session runs', { timerStatus: 'focus' }],
    ['a break runs', { timerStatus: 'break' }],
  ])('never nudges while %s', (_label, override) => {
    const { actions } = run(idleAt(WED_10), WED_10, WED_10 + 60 * MIN, () => ({ ...PRESENT, ...override }));
    expect(actions).toEqual([]);
  });

  it('never nudges outside work hours', () => {
    const evening = new Date(2026, 8, 23, 18, 0).getTime();
    const early = new Date(2026, 8, 23, 6, 0).getTime();
    expect(run(idleAt(evening), evening, evening + 60 * MIN).actions).toEqual([]);
    expect(run(idleAt(early), early, early + 110 * MIN).actions).toEqual([]);
  });

  it('starts counting when work hours begin, not before', () => {
    const early = new Date(2026, 8, 23, 7, 30).getTime();
    const { actions } = run(idleAt(early), early, early + 45 * MIN);
    // 08:00 opens the gate, the nudge follows 10 active minutes later
    expect(actions).toEqual([{ t: early + 40 * MIN, action: expect.objectContaining({ type: 'show-nudge' }) }]);
  });

  it('never nudges at the weekend', () => {
    expect(run(idleAt(SAT_10), SAT_10, SAT_10 + 60 * MIN).actions).toEqual([]);
  });

  it('postpones while away and counts 10 fresh minutes after coming back', () => {
    const back = WED_10 + 8 * MIN;
    const { actions } = run(idleAt(WED_10), WED_10, WED_10 + 20 * MIN, (t) => ({
      ...PRESENT,
      systemIdleSec: t >= WED_10 + 5 * MIN && t < back ? 300 : 5,
    }));
    expect(actions).toEqual([{ t: back + 10 * MIN, action: expect.objectContaining({ type: 'show-nudge' }) }]);
  });
});

describe('snooze', () => {
  it('suppresses nudge and escalation for 15 minutes, then nudges again', () => {
    const nudged = run(idleAt(WED_10), WED_10, WED_10 + 10 * MIN).state;
    const snoozedAt = WED_10 + 11 * MIN;
    const snoozed = onSnooze(nudged, snoozedAt);

    const { actions } = run(snoozed, snoozedAt, snoozedAt + 15 * MIN);
    expect(actions).toEqual([
      {
        t: snoozedAt + 15 * MIN,
        // Idle start kept for the display; escalation counts from the new nudge
        action: { type: 'show-nudge', idleSince: WED_10, kickoffAt: snoozedAt + 30 * MIN },
      },
    ]);
  });
});

describe('escalation', () => {
  it('starts the kickoff 15 minutes after the nudge', () => {
    const { actions, state } = run(idleAt(WED_10), WED_10, WED_10 + 25 * MIN);
    expect(actions.map((a) => [a.t - WED_10, a.action.type])).toEqual([
      [10 * MIN, 'show-nudge'],
      [25 * MIN, 'kickoff'],
    ]);
    expect(state.phase).toBe('off');

    // If the kickoff never got the timer going, the clock simply starts over
    const after = run(state, WED_10 + 25.5 * MIN, WED_10 + 35.5 * MIN);
    expect(types(after.actions)).toEqual(['show-nudge']);
  });

  it('dismissing the nudge does not stop the escalation', () => {
    // Dismiss only hides the card; the machine is never told. Same run as above.
    const { actions } = run(idleAt(WED_10), WED_10, WED_10 + 25 * MIN);
    expect(types(actions)).toEqual(['show-nudge', 'kickoff']);
  });

  it('does not escalate if the user went away in the meantime', () => {
    const { actions } = run(idleAt(WED_10), WED_10, WED_10 + 26 * MIN, (t) => ({
      ...PRESENT,
      systemIdleSec: t >= WED_10 + 18 * MIN && t < WED_10 + 22 * MIN ? 600 : 5,
    }));
    // Away at 18m takes the nudge down; back at 22m restarts the 10-minute clock
    expect(actions.map((a) => [a.t - WED_10, a.action.type])).toEqual([
      [10 * MIN, 'show-nudge'],
      [18 * MIN, 'hide-nudge'],
    ]);
  });
});

describe('resets', () => {
  it('resets on timer activity and hides the nudge', () => {
    const nudged = run(idleAt(WED_10), WED_10, WED_10 + 12 * MIN).state;
    const started = onTimerStatus(nudged, 'focus', 'idle', WED_10 + 12 * MIN);
    expect(started.action).toEqual({ type: 'hide-nudge' });
    expect(started.state.phase).toBe('off');

    // Focus stopped again at 13m: a fresh 10-minute clock
    const stopped = onTimerStatus(started.state, 'idle', 'focus', WED_10 + 13 * MIN).state;
    const { actions } = run(stopped, WED_10 + 13 * MIN, WED_10 + 23 * MIN);
    expect(actions).toEqual([{ t: WED_10 + 23 * MIN, action: expect.objectContaining({ type: 'show-nudge' }) }]);
  });

  it('resets on unlock/resume: 10 active minutes after coming back, not immediately', () => {
    const unlockAt = WED_10 + 30 * MIN;
    const { actions } = run(idleAt(WED_10), WED_10, WED_10 + 45 * MIN, (t) => ({
      ...PRESENT,
      locked: t >= WED_10 + 5 * MIN && t < unlockAt,
    }));
    expect(actions).toEqual([{ t: unlockAt + 10 * MIN, action: expect.objectContaining({ type: 'show-nudge' }) }]);
  });

  it('ignores a stop that arrives when the timer is already idle', () => {
    const counting = idleAt(WED_10);
    expect(onTimerStatus(counting, 'idle', 'idle', WED_10 + 5 * MIN).state).toBe(counting);
  });
});

describe('break end', () => {
  it('escalates the same way: red nudge at 10 minutes, kickoff 15 minutes after the break ended', () => {
    const breakEnded = onTimerStatus(INITIAL_IDLE_STATE, 'idle', 'break', WED_10).state;
    const { actions } = run(breakEnded, WED_10, WED_10 + 16 * MIN);
    expect(actions.map((a) => [a.t - WED_10, a.action])).toEqual([
      [10 * MIN, { type: 'show-nudge', idleSince: WED_10, kickoffAt: WED_10 + 15 * MIN }],
      [15 * MIN, { type: 'kickoff' }],
    ]);
  });

  it('a stop right after the break (duplicate event) keeps the break-end clock', () => {
    const breakEnded = onTimerStatus(INITIAL_IDLE_STATE, 'idle', 'break', WED_10).state;
    const after = onTimerStatus(breakEnded, 'idle', 'idle', WED_10 + 1000).state;
    expect(after.origin).toBe('break-end');
  });

  it('uses the configured numbers', () => {
    expect(IDLE_DEFAULTS.nudgeAfterMs).toBe(10 * MIN);
    expect(IDLE_DEFAULTS.escalateAfterMs).toBe(15 * MIN);
    expect(IDLE_DEFAULTS.snoozeMs).toBe(15 * MIN);
    expect(IDLE_DEFAULTS.awayAfterSec).toBe(120);
  });
});

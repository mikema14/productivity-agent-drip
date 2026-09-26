import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupMainTimerListeners, useTimerStore } from './timerStore';
import { resetTimer, setTimer } from '../test/timerState';
import type { IdleCommand, PomodoroSession } from '../types';

/**
 * Kickoff scope only (PHASE4_PLAN.md §6.1): sources, the Raycast flag and the
 * no-row exits. The rest of the store stays on the inventory's "no coverage" list.
 */

const today = new Date().toISOString().split('T')[0];

// setupMainTimerListeners registers once per module; capture its callbacks
// the first time and reuse them (they read window.timerAPI lazily).
let idleCommand: ((command: IdleCommand) => void) | null = null;
let extended: ((remaining: number) => void) | null = null;
function listeners() {
  if (!idleCommand) {
    setupMainTimerListeners();
    idleCommand = vi.mocked(window.timerAPI.onIdleCommand).mock.calls[0][0];
    extended = vi.mocked(window.timerAPI.onTimerExtended).mock.calls[0][0];
  }
  return { idleCommand: idleCommand!, extended: extended! };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('timerStore — kickoff', () => {
  beforeEach(() => {
    resetTimer();
    setTimer({ durationMinutes: 25, sessionCount: 0 });
    window.timerAPI.startMainTimer = vi.fn(async () => ({ raycastFocus: true }));
    window.timerAPI.saveSession = vi.fn(async () => 'new-session');
  });
  afterEach(() => resetTimer());

  it('startFocus with kickoffSeconds starts a 120 s main timer that rolls into the full session, source now, Raycast from the result', async () => {
    await useTimerStore.getState().startFocus('689742', true, false, 120);
    expect(window.timerAPI.startMainTimer).toHaveBeenCalledWith(120, 'focus', 5, '689742', 1500);
    const s = useTimerStore.getState();
    expect(s.status).toBe('focus');
    expect(s.kickoff).toBe('warmup');
    expect(s.kickoffSource).toBe('now');
    expect(s.kickoffEscalateMinutes).toBeNull();
    expect(s.raycastFocus).toBe(true);
    expect(s.totalDuration).toBe(120);
  });

  it('a plain focus start carries no kickoff source and still mirrors the Raycast flag', async () => {
    window.timerAPI.startMainTimer = vi.fn(async () => ({ raycastFocus: false }));
    await useTimerStore.getState().startFocus('689742', true);
    const s = useTimerStore.getState();
    expect(s.kickoff).toBeNull();
    expect(s.kickoffSource).toBeNull();
    expect(s.raycastFocus).toBe(false);
  });

  it('startKickoff(120, auto, 15) resolves the task through getLastSessionWithTask(today) and labels the source', async () => {
    window.timerAPI.getLastSessionWithTask = vi.fn(async () => ({ task_id: '600001' } as PomodoroSession));
    await useTimerStore.getState().startKickoff(120, 'auto', 15);
    expect(window.timerAPI.getLastSessionWithTask).toHaveBeenCalledWith(today);
    expect(window.timerAPI.startMainTimer).toHaveBeenCalledWith(120, 'focus', 5, '600001', 1500);
    const s = useTimerStore.getState();
    expect(s.currentTaskId).toBe('600001');
    expect(s.kickoffSource).toBe('auto');
    expect(s.kickoffEscalateMinutes).toBe(15);
  });

  it('startKickoff falls back to the persisted lastTaskId, then to no task', async () => {
    setTimer({ lastTaskId: '600009' });
    await useTimerStore.getState().startKickoff(120);
    expect(window.timerAPI.startMainTimer).toHaveBeenLastCalledWith(120, 'focus', 5, '600009', 1500);
    expect(useTimerStore.getState().kickoffSource).toBe('now');

    resetTimer();
    setTimer({ durationMinutes: 25, lastTaskId: null });
    await useTimerStore.getState().startKickoff(120, 'deeplink', 15);
    expect(window.timerAPI.startMainTimer).toHaveBeenLastCalledWith(120, 'focus', 5, undefined, 1500);
    expect(useTimerStore.getState().currentTaskId).toBeNull();
    expect(useTimerStore.getState().kickoffSource).toBe('deeplink');
  });

  it('the idle kickoff command passes seconds, source and escalateMinutes to startKickoff', async () => {
    const { idleCommand } = listeners();
    idleCommand({ type: 'kickoff', seconds: 120, source: 'nudge', escalateMinutes: 15 });
    await flush();
    expect(window.timerAPI.startMainTimer).toHaveBeenCalledWith(120, 'focus', 5, undefined, 1500);
    const s = useTimerStore.getState();
    expect(s.kickoff).toBe('warmup');
    expect(s.kickoffSource).toBe('nudge');
    expect(s.kickoffEscalateMinutes).toBe(15);
  });

  it('the extension that lands at zero flips warmup → rolled; a +5 min mid-warmup does not', () => {
    const { extended } = listeners();
    setTimer({ status: 'focus', kickoff: 'warmup', remainingSeconds: 60, totalDuration: 120, intervalId: 1 });
    extended(360);
    expect(useTimerStore.getState().kickoff).toBe('warmup');
    expect(useTimerStore.getState().totalDuration).toBe(420);

    setTimer({ remainingSeconds: 0, totalDuration: 120 });
    extended(1500);
    expect(useTimerStore.getState().kickoff).toBe('rolled');
    expect(useTimerStore.getState().totalDuration).toBe(1620);
  });

  it('stopKickoff saves what ran as a pomodoro row with comment Kickoff and clears the kickoff fields', async () => {
    setTimer({
      status: 'focus', kickoff: 'rolled', kickoffSource: 'auto', kickoffEscalateMinutes: 15, raycastFocus: true,
      sessionStartTime: new Date(Date.now() - 130_000), currentTaskId: '689742', currentBillable: true, intention: '', intervalId: 1,
    });
    await useTimerStore.getState().stopKickoff();
    expect(window.timerAPI.stopMainTimer).toHaveBeenCalled();
    expect(window.timerAPI.saveSession).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'pomodoro', comment: 'Kickoff', task_id: '689742', duration_minutes: 2, billable: 1 })
    );
    const s = useTimerStore.getState();
    expect(s.status).toBe('idle');
    expect(s.kickoff).toBeNull();
    expect(s.kickoffSource).toBeNull();
    expect(s.kickoffEscalateMinutes).toBeNull();
    expect(s.raycastFocus).toBe(false);
    expect(s.lastTaskId).toBe('689742');
  });

  it('reset during the warmup saves nothing and clears kickoff / source / Raycast (the takeover\'s esc Stop)', async () => {
    setTimer({
      status: 'focus', kickoff: 'warmup', kickoffSource: 'auto', kickoffEscalateMinutes: 15, raycastFocus: true,
      sessionStartTime: new Date(Date.now() - 40_000), currentTaskId: '689742', intervalId: 1,
    });
    await useTimerStore.getState().reset();
    expect(window.timerAPI.stopMainTimer).toHaveBeenCalled();
    expect(window.timerAPI.saveSession).not.toHaveBeenCalled();
    const s = useTimerStore.getState();
    expect(s.status).toBe('idle');
    expect(s.kickoff).toBeNull();
    expect(s.kickoffSource).toBeNull();
    expect(s.kickoffEscalateMinutes).toBeNull();
    expect(s.raycastFocus).toBe(false);
  });

  it('kickoffSource, kickoffEscalateMinutes and raycastFocus are never persisted', () => {
    setTimer({ kickoffSource: 'auto', kickoffEscalateMinutes: 15, raycastFocus: true, durationMinutes: 50 });
    const stored = JSON.parse(localStorage.getItem('timer-storage') || '{}');
    expect(stored.state.durationMinutes).toBe(50);
    expect(stored.state).not.toHaveProperty('kickoffSource');
    expect(stored.state).not.toHaveProperty('kickoffEscalateMinutes');
    expect(stored.state).not.toHaveProperty('raycastFocus');
  });
});

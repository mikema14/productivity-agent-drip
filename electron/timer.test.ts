import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The break pill has no end of its own: every way out of a break (skip, stop,
 * a focus started mid-break, the break's own end) must hide it, and nothing
 * else may.
 */

const hideBreakPill = vi.fn();
vi.mock('./overlayWindow', () => ({
  hideBreakPill: () => hideBreakPill(),
  sendTickToOverlay: vi.fn(),
  sampleActiveDisplay: vi.fn(),
}));
vi.mock('electron', () => ({ BrowserWindow: class {} }));
vi.mock('./tray', () => ({ updateTray: vi.fn() }));
vi.mock('../src/services/db', () => ({ saveSetting: vi.fn() }));
vi.mock('./raycastFocus', () => ({
  raycastFocusStart: vi.fn(),
  raycastFocusEnd: vi.fn(),
  isRaycastFocusEnabled: () => false,
}));

type Timer = typeof import('./timer');

async function boot(): Promise<Timer> {
  vi.resetModules();
  return import('./timer');
}

describe('main timer — break pill', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hideBreakPill.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('hides the pill when a break is stopped (Skip break, drip://skip-break, drip://stop)', async () => {
    const timer = await boot();
    timer.startTimer(300, 'break');
    expect(hideBreakPill).not.toHaveBeenCalled();
    timer.stopTimer();
    expect(hideBreakPill).toHaveBeenCalledTimes(1);
    timer.cleanupTimer();
  });

  it('hides the pill when a focus starts during a break', async () => {
    const timer = await boot();
    timer.startTimer(300, 'break');
    timer.startTimer(1500, 'focus', 5, '689742');
    expect(hideBreakPill).toHaveBeenCalledTimes(1);
    timer.cleanupTimer();
  });

  it('hides the pill when the break runs out', async () => {
    const timer = await boot();
    timer.startTimer(2, 'break');
    vi.advanceTimersByTime(4000);
    expect(timer.getTimerState().status).toBe('idle');
    expect(hideBreakPill).toHaveBeenCalledTimes(1);
  });

  it('keeps the pill while a break is paused and resumed', async () => {
    const timer = await boot();
    timer.startTimer(300, 'break');
    timer.pauseTimer();
    timer.resumeTimer();
    expect(hideBreakPill).not.toHaveBeenCalled();
    timer.cleanupTimer();
  });

  it('leaves the overlay alone outside breaks: idle → break, break → break, focus → idle', async () => {
    const timer = await boot();
    timer.startTimer(1500, 'focus', 5, '689742');
    timer.stopTimer();
    timer.startTimer(300, 'break');
    timer.startTimer(600, 'break');
    expect(hideBreakPill).not.toHaveBeenCalled();
    timer.cleanupTimer();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimerListener } from './timer';

/**
 * The wiring around the idle machine, pause side only: persistence of the
 * pause across a restart, the change broadcast, and the overlay / tray entry
 * points. The machine itself is covered in idleWatcher.test.ts.
 */

const settings = new Map<string, string>();
vi.mock('../src/services/db', () => ({
  getSetting: vi.fn((key: string) => settings.get(key) ?? null),
  saveSetting: vi.fn((key: string, value: string) => {
    settings.set(key, value);
  }),
  getCalendarProposals: vi.fn(() => []),
  getLastSessionWithTask: vi.fn(() => null),
  getCachedTask: vi.fn(() => undefined),
}));

const powerListeners: Record<string, () => void> = {};
const sent: Array<[string, unknown]> = [];
const win = {
  isDestroyed: () => false,
  isMinimized: () => false,
  restore: vi.fn(),
  show: vi.fn(),
  showInactive: vi.fn(),
  moveTop: vi.fn(),
  webContents: { send: vi.fn((channel: string, payload: unknown) => sent.push([channel, payload])) },
};
vi.mock('electron', () => ({
  BrowserWindow: class {},
  powerMonitor: {
    on: vi.fn((event: string, cb: () => void) => {
      powerListeners[event] = cb;
    }),
    getSystemIdleTime: vi.fn(() => 5),
  },
}));

let visibleKind: string | null = null;
const showOverlay = vi.fn(() => {
  visibleKind = 'idle';
  return true;
});
const hideOverlay = vi.fn(() => {
  visibleKind = null;
});
vi.mock('./overlayWindow', () => ({
  getVisibleOverlayKind: () => visibleKind,
  hideOverlay: (...args: unknown[]) => hideOverlay(...args),
  showOverlay: (...args: unknown[]) => showOverlay(...args),
  sampleActiveDisplay: vi.fn(),
}));

let timerStatus: 'idle' | 'focus' | 'break' = 'idle';
let timerListener: TimerListener | null = null;
vi.mock('./timer', () => ({
  getTimerState: () => ({ status: timerStatus, remainingSeconds: 0, startTime: null }),
  setTimerListener: (next: TimerListener | null) => {
    timerListener = next;
  },
}));

vi.mock('./raycastFocus', () => ({
  raycastFocusEnd: vi.fn(),
  isRaycastFocusEnabled: () => false,
}));

const MIN = 60_000;
/** Wednesday 23 Sep 2026, 10:00 local. */
const WED_10 = new Date(2026, 8, 23, 10, 0).getTime();

async function boot() {
  vi.resetModules();
  const mod = await import('./idleNudge');
  mod.initIdleNudge(() => win as never);
  return mod;
}

describe('idleNudge — pause', () => {
  const env = { ...process.env };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(WED_10);
    delete process.env.DRIP_TEST_MODE;
    delete process.env.DRIP_IDLE_FAST;
    settings.clear();
    sent.length = 0;
    visibleKind = null;
    timerStatus = 'idle';
    timerListener = null;
    showOverlay.mockClear();
    hideOverlay.mockClear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    const mod = await import('./idleNudge');
    mod.stopIdleNudge();
    vi.useRealTimers();
    vi.restoreAllMocks();
    process.env = { ...env };
  });

  it('pauseNudges persists idleNudgePausedUntil, tells listeners and the main window, and hides the card', async () => {
    const mod = await boot();
    const seen: Array<number | null> = [];
    mod.onNudgePauseChange((until) => seen.push(until));

    // Get the nudge up first (10 minutes idle)
    vi.advanceTimersByTime(10 * MIN);
    expect(showOverlay).toHaveBeenCalledTimes(1);
    expect(visibleKind).toBe('idle');

    const until = mod.pauseNudges('1h');
    expect(until).toBe(WED_10 + 70 * MIN);
    expect(mod.getNudgePausedUntil()).toBe(until);
    expect(settings.get(mod.PAUSE_SETTING_KEY)).toBe(String(until));
    expect(seen).toEqual([until]);
    expect(sent).toContainEqual(['idle-nudge-paused', until]);
    expect(visibleKind).toBeNull();

    // Quiet for the hour, then counting: no nudge at expiry, one 10 minutes later
    vi.advanceTimersByTime(60 * MIN);
    expect(showOverlay).toHaveBeenCalledTimes(1);
    expect(mod.getNudgePausedUntil()).toBeNull();
    expect(settings.get(mod.PAUSE_SETTING_KEY)).toBe('');
    expect(seen).toEqual([until, null]);
    vi.advanceTimersByTime(10 * MIN);
    expect(showOverlay).toHaveBeenCalledTimes(2);
  });

  it('the overlay\'s idle-snooze carries the choice; rest of day runs to 18:00', async () => {
    const mod = await boot();
    expect(mod.handleIdleOverlayAction('idle-snooze', { snooze: 'day' })).toBe(true);
    const until = mod.getNudgePausedUntil();
    expect(until).toBe(new Date(2026, 8, 23, 18, 0).getTime());
    expect(settings.get(mod.PAUSE_SETTING_KEY)).toBe(String(until));
  });

  it('idle-snooze without a choice is the 15-minute pause', async () => {
    const mod = await boot();
    mod.handleIdleOverlayAction('idle-snooze');
    expect(mod.getNudgePausedUntil()).toBe(WED_10 + 15 * MIN);
  });

  it('a pause survives a restart: initIdleNudge restores the persisted end and stays quiet', async () => {
    const until = WED_10 + 45 * MIN;
    settings.set('idleNudgePausedUntil', String(until));
    const mod = await boot();
    expect(mod.getNudgePausedUntil()).toBe(until);
    expect(sent).toContainEqual(['idle-nudge-paused', until]);
    vi.advanceTimersByTime(45 * MIN);
    expect(showOverlay).not.toHaveBeenCalled();
    expect(mod.getNudgePausedUntil()).toBeNull();
    vi.advanceTimersByTime(10 * MIN);
    expect(showOverlay).toHaveBeenCalledTimes(1);
  });

  it('a stale persisted pause is cleared on start and does not pause', async () => {
    settings.set('idleNudgePausedUntil', String(WED_10 - MIN));
    const mod = await boot();
    expect(mod.getNudgePausedUntil()).toBeNull();
    expect(settings.get('idleNudgePausedUntil')).toBe('');
    vi.advanceTimersByTime(10 * MIN);
    expect(showOverlay).toHaveBeenCalledTimes(1);
  });

  it('garbage in the setting is ignored', async () => {
    settings.set('idleNudgePausedUntil', 'tomorrow');
    const mod = await boot();
    expect(mod.getNudgePausedUntil()).toBeNull();
  });

  it('resumeNudges ends the pause now, clears the setting and counts 10 fresh minutes', async () => {
    const mod = await boot();
    mod.pauseNudges('day');
    vi.advanceTimersByTime(3 * MIN);
    mod.resumeNudges();
    expect(mod.getNudgePausedUntil()).toBeNull();
    expect(settings.get(mod.PAUSE_SETTING_KEY)).toBe('');
    expect(sent.at(-1)).toEqual(['idle-nudge-paused', null]);
    vi.advanceTimersByTime(9.5 * MIN);
    expect(showOverlay).not.toHaveBeenCalled();
    vi.advanceTimersByTime(MIN);
    expect(showOverlay).toHaveBeenCalledTimes(1);
    // Not paused: a second resume changes nothing
    const writes = sent.length;
    mod.resumeNudges();
    expect(sent.length).toBe(writes);
  });

  it('a focus starting clears the pause and its persisted end', async () => {
    const mod = await boot();
    mod.pauseNudges('1h');
    timerStatus = 'focus';
    timerListener?.onStatus('focus', 'idle');
    expect(mod.getNudgePausedUntil()).toBeNull();
    expect(settings.get(mod.PAUSE_SETTING_KEY)).toBe('');
    expect(sent.at(-1)).toEqual(['idle-nudge-paused', null]);
  });

  it('DRIP_TEST_MODE: the watcher is gated, and a pause is still recorded but never nudges', async () => {
    process.env.DRIP_TEST_MODE = '1';
    const mod = await boot();
    mod.pauseNudges('15m');
    vi.advanceTimersByTime(60 * MIN);
    expect(showOverlay).not.toHaveBeenCalled();
  });
});

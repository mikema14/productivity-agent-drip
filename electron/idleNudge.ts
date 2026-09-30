import { BrowserWindow, powerMonitor } from 'electron';
import { getSetting, saveSetting, getCalendarProposals, getLastSessionWithTask, getCachedTask } from '../src/services/db';
import type { IdleCommand, KickoffSource, OverlayActionData, OverlayActionType, SnoozeChoice } from '../src/types';
import { getVisibleOverlayKind, hideOverlay, sampleActiveDisplay, showOverlay } from './overlayWindow';
import { getTimerState, setTimerListener } from './timer';
import { raycastFocusEnd, isRaycastFocusEnabled } from './raycastFocus';
import { buildNudgePayload } from './nudgePayload';
import {
  IDLE_DEFAULTS,
  IDLE_FAST,
  INITIAL_IDLE_STATE,
  nextIdleAction,
  onResume,
  onSnooze,
  onTimerStatus,
  pausedUntil,
  snoozeUntilFor,
  type IdleAction,
  type IdleState,
} from './idleWatcher';
import { resolveKickoffPrompt, type KickoffPromptOutcome } from './kickoff';

/**
 * Thin wiring around the pure idle state machine (./idleWatcher): feeds it
 * timer events, powerMonitor and settings, and carries out what it decides —
 * the red nudge, the kickoff, and the kickoff roll-over prompt.
 *
 * Timer logic stays in the main-window renderer (session recording, task,
 * billable): kickoff and "start focus" are relayed there as idle commands, the
 * same way overlay buttons are.
 *
 * A pause (the card's Snooze choice, the tray's "Pause nudges") lives in the
 * machine as the 'snoozed' phase. Its end is mirrored into the settings table
 * so it survives a restart, and broadcast (listeners here, `idle-nudge-paused`
 * to the main window) so the tray menu and the Now header can show it.
 */

const cfg = process.env.DRIP_IDLE_FAST === '1' ? IDLE_FAST : IDLE_DEFAULTS;

/** Settings key: epoch ms the current pause ends; empty when not paused. */
export const PAUSE_SETTING_KEY = 'idleNudgePausedUntil';

let state: IdleState = { ...INITIAL_IDLE_STATE };
let getWindow: () => BrowserWindow | null = () => null;
let pollTimer: NodeJS.Timeout | null = null;
let promptTimer: NodeJS.Timeout | null = null;
let screenLocked = false;
let suspended = false;

type PauseListener = (until: number | null) => void;
const pauseListeners = new Set<PauseListener>();

/** End of the current nudge pause (epoch ms), or null. */
export function getNudgePausedUntil(): number | null {
  return pausedUntil(state);
}

/** Called with the new end whenever a pause starts, ends, or is resumed. Returns the unsubscribe. */
export function onNudgePauseChange(listener: PauseListener): () => void {
  pauseListeners.add(listener);
  return () => {
    pauseListeners.delete(listener);
  };
}

function persistPause(until: number | null): void {
  try {
    saveSetting(PAUSE_SETTING_KEY, until === null ? '' : String(until));
  } catch (error) {
    console.error('[IdleNudge] Failed to persist the pause:', error);
  }
}

function readPersistedPause(): number | null {
  try {
    const raw = getSetting(PAUSE_SETTING_KEY);
    const until = raw ? Number(raw) : NaN;
    return Number.isFinite(until) ? until : null;
  } catch {
    return null;
  }
}

/**
 * The one place the state changes: any change to the pause end is persisted
 * and announced, whichever path caused it (poll expiry, snooze, resume, a
 * focus starting).
 */
function setState(next: IdleState): void {
  const before = pausedUntil(state);
  if (next.phase !== state.phase) console.log(`[IdleNudge] ${state.phase} → ${next.phase}`);
  state = next;
  const after = pausedUntil(state);
  if (after === before) return;
  persistPause(after);
  for (const listener of pauseListeners) {
    try {
      listener(after);
    } catch (error) {
      console.error('[IdleNudge] Pause listener failed:', error);
    }
  }
  const win = getWindow();
  if (win && !win.isDestroyed()) win.webContents.send('idle-nudge-paused', after);
}

/** Pause nudge and escalation for the given choice. Returns when the pause ends. */
export function pauseNudges(choice: SnoozeChoice): number {
  hideIdleNudge();
  const now = Date.now();
  const until = snoozeUntilFor(choice, now, cfg);
  setState(onSnooze(state, now, until));
  console.log(`[IdleNudge] Paused (${choice}) until ${new Date(until).toISOString()}`);
  return until;
}

/** End the pause now: a fresh idle clock starts. */
export function resumeNudges(): void {
  if (state.phase !== 'snoozed') return;
  setState(onResume(state, Date.now()));
  console.log('[IdleNudge] Resumed');
}

function isEnabled(): boolean {
  // DRIP_TEST_MODE: agent/QA runs against the real database must not nudge or take over
  if (process.env.DRIP_TEST_MODE === '1') return false;
  try {
    return getSetting('idleNudgeEnabled') !== 'false';
  } catch {
    return true;
  }
}

function localDateKey(d: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Uses today's calendar proposals already in the DB (synced by the renderer
 * from the ICS feed), so it costs one indexed query and no network. All-day
 * events are ignored — they would silence the whole day — and so are events
 * dismissed in Review: dismissed means "I wasn't in it".
 */
function isInMeeting(now: number): boolean {
  try {
    const rows = getCalendarProposals(localDateKey(new Date(now))) as Array<{
      start_at: string;
      end_at: string;
      duration_minutes: number;
    }>;
    return rows.some(
      (row) => row.duration_minutes < 24 * 60 && Date.parse(row.start_at) <= now && now < Date.parse(row.end_at)
    );
  } catch {
    return false;
  }
}

function sendCommand(command: IdleCommand): boolean {
  const win = getWindow();
  if (!win || win.isDestroyed()) return false;
  win.webContents.send('idle-command', command);
  return true;
}

function hideIdleNudge(): void {
  if (getVisibleOverlayKind() === 'idle') hideOverlay();
}

function apply(result: { state: IdleState; action: IdleAction }): void {
  setState(result.state);

  switch (result.action.type) {
    case 'show-nudge':
      // The display sample goes stale once the timer stops, so take a fresh one.
      sampleActiveDisplay();
      showOverlay(
        buildNudgePayload(result.action, cfg, {
          // The renderer resolves the kickoff's task the same way (today's last
          // session with a task first), so the copy names the id it will use.
          lastTask: () => getLastSessionWithTask(localDateKey(new Date()))?.task_id,
          taskTitle: (id) => (getCachedTask(id) as { title?: string } | undefined)?.title,
          raycastFocus: isRaycastFocusEnabled,
        }),
        { force: true }
      );
      break;
    case 'hide-nudge':
      hideIdleNudge();
      break;
    case 'kickoff':
      console.log('[IdleNudge] Nudge ignored — starting kickoff');
      startKickoff('auto');
      break;
  }
}

function poll(): void {
  try {
    const now = Date.now();
    const timerStatus = getTimerState().status;
    apply(
      nextIdleAction(
        state,
        {
          timerStatus,
          systemIdleSec: powerMonitor.getSystemIdleTime(),
          enabled: isEnabled(),
          // Only worth a query while there is something to decide.
          inMeeting: timerStatus === 'idle' && isInMeeting(now),
          locked: screenLocked || suspended,
        },
        now,
        cfg
      )
    );
  } catch (error) {
    console.error('[IdleNudge] Poll failed:', error);
  }
}

/**
 * Start a kickoff: 2 minutes of focus on the last task, rolling into a full
 * session. `auto` is the takeover — it also brings Drip to the front, without
 * taking keyboard focus from whatever the user is typing into. `nudge` (the
 * card's Kickoff key) and `deeplink` (`drip://kickoff`) show the window
 * normally; the source is carried so the takeover can say where it came from.
 */
export function startKickoff(source: Exclude<KickoffSource, 'now'>): void {
  if (getTimerState().status === 'focus') {
    console.log('[IdleNudge] Kickoff ignored — focus already running');
    return;
  }

  hideIdleNudge();
  const command: IdleCommand = {
    type: 'kickoff',
    seconds: cfg.kickoffSeconds,
    source,
    escalateMinutes: Math.round(cfg.escalateAfterMs / 60000),
  };
  if (!sendCommand(command)) {
    console.warn('[IdleNudge] No main window — kickoff skipped');
    return;
  }

  const win = getWindow();
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  if (source === 'auto') {
    win.showInactive();
    win.moveTop();
  } else {
    win.show();
  }
}

function clearPromptTimer(): void {
  if (promptTimer) {
    clearTimeout(promptTimer);
    promptTimer = null;
  }
}

function finishKickoffPrompt(outcome: KickoffPromptOutcome): void {
  clearPromptTimer();
  if (getVisibleOverlayKind() === 'kickoff-continue') hideOverlay();

  const result = resolveKickoffPrompt(outcome);
  if (result.stopSession) sendCommand({ type: 'stop-kickoff' });
  if (result.endRaycast) raycastFocusEnd();
}

function onKickoffRollover(rolloverSeconds: number): void {
  clearPromptTimer();
  sampleActiveDisplay();
  const shown = showOverlay(
    {
      kind: 'kickoff-continue',
      focusMinutes: Math.round(rolloverSeconds / 60),
      countdownSeconds: cfg.kickoffPromptSeconds,
    },
    { force: true }
  );
  if (shown) {
    promptTimer = setTimeout(() => finishKickoffPrompt('timeout'), cfg.kickoffPromptSeconds * 1000);
  }
}

/**
 * Overlay buttons that belong to the idle nudge or the kickoff prompt. Returns
 * false for everything else, which keeps the existing session-end relay.
 */
export function handleIdleOverlayAction(type: OverlayActionType, data?: OverlayActionData): boolean {
  switch (type) {
    case 'idle-start-focus':
      hideIdleNudge();
      sendCommand({ type: 'start-focus' });
      return true;
    case 'idle-kickoff':
      startKickoff('nudge');
      return true;
    case 'idle-snooze':
      pauseNudges(data?.snooze ?? '15m');
      return true;
    case 'kickoff-keep':
      finishKickoffPrompt('keep-going');
      return true;
    case 'kickoff-stop':
      finishKickoffPrompt('stop');
      return true;
    case 'dismiss': {
      const kind = getVisibleOverlayKind();
      // Dismissing the nudge is ignoring it: the escalation clock keeps running.
      if (kind === 'idle') {
        hideOverlay();
        return true;
      }
      if (kind === 'kickoff-continue') {
        finishKickoffPrompt('keep-going');
        return true;
      }
      return false;
    }
    default:
      return false;
  }
}

/** Call once the app is ready (powerMonitor needs it). */
export function initIdleNudge(windowGetter: () => BrowserWindow | null): void {
  getWindow = windowGetter;

  setTimerListener({
    onStatus: (status, previous) => {
      // The session the roll-over prompt was about has ended or been replaced
      if (promptTimer) {
        clearPromptTimer();
        if (getVisibleOverlayKind() === 'kickoff-continue') hideOverlay();
      }
      apply(onTimerStatus(state, status, previous, Date.now()));
    },
    onKickoffRollover,
  });

  // Locked or asleep: no clock. Unlocking/waking restarts it from zero on the
  // next poll, so coming back to the Mac never nudges straight away.
  powerMonitor.on('lock-screen', () => {
    screenLocked = true;
    poll();
  });
  powerMonitor.on('unlock-screen', () => {
    screenLocked = false;
    poll();
  });
  powerMonitor.on('suspend', () => {
    suspended = true;
    poll();
  });
  powerMonitor.on('resume', () => {
    suspended = false;
    poll();
  });

  if (cfg !== IDLE_DEFAULTS) console.log('[IdleNudge] DRIP_IDLE_FAST=1 — seconds instead of minutes');

  // A pause survives a restart; a stale one is cleared.
  const persisted = readPersistedPause();
  if (persisted !== null) {
    const now = Date.now();
    if (persisted > now) {
      setState(onSnooze(state, now, persisted));
      console.log(`[IdleNudge] Pause restored until ${new Date(persisted).toISOString()}`);
    } else {
      persistPause(null);
    }
  }

  poll();
  pollTimer = setInterval(poll, cfg.pollMs);
}

export function stopIdleNudge(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  clearPromptTimer();
  setTimerListener(null);
}

import { BrowserWindow, powerMonitor } from 'electron';
import { getSetting, getCalendarProposals } from '../src/services/db';
import type { IdleCommand, OverlayActionType } from '../src/types';
import { getVisibleOverlayKind, hideOverlay, sampleActiveDisplay, showOverlay } from './overlayWindow';
import { getTimerState, setTimerListener } from './timer';
import { raycastFocusEnd } from './raycastFocus';
import {
  IDLE_DEFAULTS,
  IDLE_FAST,
  INITIAL_IDLE_STATE,
  nextIdleAction,
  onSnooze,
  onTimerStatus,
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
 */

const cfg = process.env.DRIP_IDLE_FAST === '1' ? IDLE_FAST : IDLE_DEFAULTS;

let state: IdleState = { ...INITIAL_IDLE_STATE };
let getWindow: () => BrowserWindow | null = () => null;
let pollTimer: NodeJS.Timeout | null = null;
let promptTimer: NodeJS.Timeout | null = null;
let screenLocked = false;
let suspended = false;

function isEnabled(): boolean {
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
 * events are ignored — they would silence the whole day.
 */
function isInMeeting(now: number): boolean {
  try {
    const rows = getCalendarProposals(localDateKey(new Date(now)), true) as Array<{
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
  if (result.state.phase !== state.phase) {
    console.log(`[IdleNudge] ${state.phase} → ${result.state.phase}`);
  }
  state = result.state;

  switch (result.action.type) {
    case 'show-nudge':
      // The display sample goes stale once the timer stops, so take a fresh one.
      sampleActiveDisplay();
      showOverlay(
        {
          kind: 'idle',
          idleSince: new Date(result.action.idleSince).toISOString(),
          kickoffAt: new Date(result.action.kickoffAt).toISOString(),
          kickoffSeconds: cfg.kickoffSeconds,
          snoozeSeconds: Math.round(cfg.snoozeMs / 1000),
        },
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
 * taking keyboard focus from whatever the user is typing into.
 */
export function startKickoff(source: 'auto' | 'manual'): void {
  if (getTimerState().status === 'focus') {
    console.log('[IdleNudge] Kickoff ignored — focus already running');
    return;
  }

  hideIdleNudge();
  if (!sendCommand({ type: 'kickoff', seconds: cfg.kickoffSeconds })) {
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
export function handleIdleOverlayAction(type: OverlayActionType): boolean {
  switch (type) {
    case 'idle-start-focus':
      hideIdleNudge();
      sendCommand({ type: 'start-focus' });
      return true;
    case 'idle-kickoff':
      startKickoff('manual');
      return true;
    case 'idle-snooze':
      hideIdleNudge();
      state = onSnooze(state, Date.now(), cfg);
      console.log(`[IdleNudge] Snoozed for ${Math.round(cfg.snoozeMs / 60000)}m`);
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
  poll();
  pollTimer = setInterval(poll, cfg.pollMs);
}

export function stopIdleNudge(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  clearPromptTimer();
  setTimerListener(null);
}

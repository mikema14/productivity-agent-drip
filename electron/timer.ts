import { BrowserWindow } from 'electron';
import { updateTray } from './tray';
import { sendTickToOverlay, sampleActiveDisplay } from './overlayWindow';
import { saveSetting } from '../src/services/db';
import { raycastFocusStart, raycastFocusEnd, isRaycastFocusEnabled } from './raycastFocus';
import { atCountdownZero, raycastSecondsFor } from './kickoff';

interface TimerState {
  status: 'idle' | 'focus' | 'break';
  remainingSeconds: number;
  intervalId: NodeJS.Timeout | null;
  startTime: Date | null;
  currentTaskId: string | null;
  totalDuration: number;
  paused: boolean;
  nextBreakDuration?: 5 | 10; // Duration in minutes for next break
  tickCount: number; // Track ticks for periodic DB writes
  /** Kickoff only: seconds to extend by at zero instead of completing. */
  rolloverSeconds: number;
}

const state: TimerState = {
  status: 'idle',
  remainingSeconds: 0,
  intervalId: null,
  startTime: null,
  currentTaskId: null,
  totalDuration: 0,
  paused: false,
  tickCount: 0,
  rolloverSeconds: 0,
};

export type TimerStatus = TimerState['status'];

/**
 * Status transitions and kickoff roll-overs, for the idle watcher. A single
 * listener: the watcher is the only consumer.
 */
export interface TimerListener {
  onStatus: (status: TimerStatus, previous: TimerStatus) => void;
  onKickoffRollover: (rolloverSeconds: number) => void;
}

let listener: TimerListener | null = null;

export function setTimerListener(next: TimerListener | null): void {
  listener = next;
}

function setStatus(status: TimerStatus): void {
  const previous = state.status;
  state.status = status;
  if (previous !== status || status !== 'idle') {
    try {
      listener?.onStatus(status, previous);
    } catch (error) {
      console.error('[MainTimer] Timer listener failed:', error);
    }
  }
}

function writeTimerState() {
  try {
    const payload = JSON.stringify({
      status: state.status,
      remainingSeconds: state.remainingSeconds,
      startTime: state.startTime ? state.startTime.toISOString() : null,
      totalDuration: state.totalDuration,
      taskId: state.currentTaskId,
      paused: state.paused,
    });
    saveSetting('timer_state', payload);
  } catch (error) {
    console.error('[MainTimer] Failed to write timer state to DB:', error);
  }
}

function writePendingBreakState(breakDurationMinutes: 5 | 10, taskId: string | null) {
  try {
    const payload = JSON.stringify({
      status: state.status,
      remainingSeconds: state.remainingSeconds,
      startTime: null,
      totalDuration: state.totalDuration,
      taskId: state.currentTaskId,
      paused: state.paused,
      pendingBreak: {
        durationMinutes: breakDurationMinutes,
        isLong: breakDurationMinutes === 10,
        taskId,
      },
    });
    saveSetting('timer_state', payload);
  } catch (error) {
    console.error('[MainTimer] Failed to write pending break state:', error);
  }
}

let mainWindow: BrowserWindow | null = null;

export function setMainWindowReference(window: BrowserWindow | null) {
  mainWindow = window;
}

function sendToRenderer(channel: string, ...args: any[]) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

function formatTrayTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * `kickoffRolloverSeconds` (focus only) makes this a kickoff: at zero the
 * session extends itself by that much instead of completing.
 *
 * Returns whether Raycast Focus is being asked to start with this timer
 * (focus + enabled), so the renderer can show it.
 */
export function startTimer(
  duration: number,
  timerType: 'focus' | 'break',
  nextBreakDuration?: 5 | 10,
  taskId?: string,
  kickoffRolloverSeconds?: number
): boolean {
  // Clear any existing interval
  if (state.intervalId) {
    console.log('[MainTimer] Clearing existing interval before starting new timer');
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  state.remainingSeconds = duration;
  state.startTime = new Date();
  state.totalDuration = duration;
  state.currentTaskId = taskId || null;
  state.paused = false;
  state.tickCount = 0;
  state.nextBreakDuration = nextBreakDuration;
  state.rolloverSeconds = timerType === 'focus' ? Math.max(0, kickoffRolloverSeconds || 0) : 0;
  setStatus(timerType);

  console.log(`[MainTimer] Starting ${timerType} timer for ${duration} seconds, taskId: ${taskId || 'none'}`);
  if (nextBreakDuration) {
    console.log(`[MainTimer] Next break duration will be: ${nextBreakDuration} minutes`);
  }

  // Update tray immediately
  const prefix = timerType === 'break' ? 'Break ' : '';
  updateTray(prefix + formatTrayTime(duration));

  // Write initial state to DB for Raycast
  writeTimerState();

  // Mirror into Raycast Focus (breaks end any running Focus session)
  const raycastFocus = timerType === 'focus' && isRaycastFocusEnabled();
  if (timerType === 'focus') {
    raycastFocusStart(raycastSecondsFor(state), taskId);
  } else {
    raycastFocusEnd();
  }

  // Create interval in main process (won't be throttled)
  state.intervalId = setInterval(() => {
    tick();
  }, 1000);

  return raycastFocus;
}

function tick() {
  if (state.remainingSeconds <= 0) {
    const zero = atCountdownZero(state);
    if (zero.type === 'rollover') {
      rollOver(zero.next.remainingSeconds, zero.next.totalDuration);
      return;
    }
    console.log('[MainTimer] Timer complete');
    handleComplete();
    return;
  }

  state.remainingSeconds--;
  state.tickCount++;

  // Update tray
  const prefix = state.status === 'break' ? 'Break ' : '';
  updateTray(prefix + formatTrayTime(state.remainingSeconds));

  // Write timer state to DB every 10 seconds for Raycast
  if (state.tickCount % 10 === 0) {
    writeTimerState();
  }

  // Notify renderer of time update
  sendToRenderer('timer-tick', state.remainingSeconds);

  // Feed the overlay's break countdown (no-ops unless the break pill is up)
  sendTickToOverlay(state.status, state.remainingSeconds);

  // Remember which display is in use, so the overlay lands there at session end
  if (state.tickCount % 5 === 0) {
    sampleActiveDisplay();
  }
}

/**
 * Kickoff reached zero: same session, extended by the full focus length.
 * Raycast was started for the whole thing, so it is left alone.
 */
function rollOver(remainingSeconds: number, totalDuration: number) {
  const added = remainingSeconds;
  state.remainingSeconds = remainingSeconds;
  state.totalDuration = totalDuration;
  state.rolloverSeconds = 0;
  console.log(`[MainTimer] Kickoff rolled over into ${added}s of focus`);

  updateTray(formatTrayTime(state.remainingSeconds));
  writeTimerState();
  sendToRenderer('timer-extended', state.remainingSeconds);

  try {
    listener?.onKickoffRollover(added);
  } catch (error) {
    console.error('[MainTimer] Kickoff listener failed:', error);
  }
}

function handleComplete() {
  // Clear interval
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  const completedType = state.status;
  const savedBreakDuration = state.nextBreakDuration;
  const savedTaskId = state.currentTaskId;

  // Update tray with appropriate message
  if (completedType === 'focus' && savedBreakDuration) {
    // Focus session complete - suggest break with duration
    updateTray(`${savedBreakDuration}m Break`);
    console.log(`[MainTimer] Focus complete - suggesting ${savedBreakDuration}m break`);
  } else if (completedType === 'break') {
    // Break complete - ready for next session
    updateTray('Ready');
    console.log('[MainTimer] Break complete - ready for next session');
  } else {
    // Fallback for other cases
    updateTray('Ready');
  }

  // Reset state
  setStatus('idle');
  state.remainingSeconds = 0;
  state.startTime = null;
  state.currentTaskId = null;
  state.totalDuration = 0;
  state.paused = false;
  state.nextBreakDuration = undefined; // Clear for next session
  state.rolloverSeconds = 0;

  raycastFocusEnd();

  // Write state to DB for Raycast — include pendingBreak if focus just completed
  if (completedType === 'focus' && savedBreakDuration) {
    writePendingBreakState(savedBreakDuration, savedTaskId);
  } else {
    writeTimerState();
  }

  // Notify renderer
  sendToRenderer('timer-complete', completedType);

  console.log(`[MainTimer] ${completedType} complete notification sent to renderer`);
}

export function pauseTimer() {
  if (state.intervalId) {
    console.log('[MainTimer] Pausing timer');
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.paused = true;
    writeTimerState();
    if (state.status === 'focus') raycastFocusEnd();
  }
}

export function resumeTimer() {
  if (state.status !== 'idle' && !state.intervalId) {
    console.log('[MainTimer] Resuming timer');
    state.paused = false;
    writeTimerState();
    if (state.status === 'focus') raycastFocusStart(raycastSecondsFor(state), state.currentTaskId);
    state.intervalId = setInterval(() => {
      tick();
    }, 1000);
  }
}

export function stopTimer() {
  console.log('[MainTimer] Stopping timer');

  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  setStatus('idle');
  state.remainingSeconds = 0;
  state.startTime = null;
  state.currentTaskId = null;
  state.totalDuration = 0;
  state.paused = false;
  state.rolloverSeconds = 0;

  updateTray('Ready');
  writeTimerState();
  raycastFocusEnd();
}

export function getTimerState() {
  return {
    status: state.status,
    remainingSeconds: state.remainingSeconds,
    startTime: state.startTime,
  };
}

export function extendTimer(additionalSeconds: number) {
  if (state.status === 'focus') {
    state.remainingSeconds += additionalSeconds;
    console.log(`[MainTimer] Extended timer by ${additionalSeconds}s, new total: ${state.remainingSeconds}s`);

    // Update tray immediately
    updateTray(formatTrayTime(state.remainingSeconds));

    if (!state.paused) raycastFocusStart(raycastSecondsFor(state), state.currentTaskId);

    // Notify renderer
    sendToRenderer('timer-extended', state.remainingSeconds);
  }
}

// Cleanup on app quit
export function cleanupTimer() {
  raycastFocusEnd();
  if (state.intervalId) {
    console.log('[MainTimer] Cleaning up timer interval');
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
}

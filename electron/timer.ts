import { BrowserWindow } from 'electron';
import { updateTray } from './tray';
import { sendTickToOverlay } from './overlayWindow';
import { saveSetting } from '../src/services/db';

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
};

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

export function startTimer(duration: number, timerType: 'focus' | 'break', nextBreakDuration?: 5 | 10, taskId?: string) {
  // Clear any existing interval
  if (state.intervalId) {
    console.log('[MainTimer] Clearing existing interval before starting new timer');
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  state.status = timerType;
  state.remainingSeconds = duration;
  state.startTime = new Date();
  state.totalDuration = duration;
  state.currentTaskId = taskId || null;
  state.paused = false;
  state.tickCount = 0;
  state.nextBreakDuration = nextBreakDuration;

  console.log(`[MainTimer] Starting ${timerType} timer for ${duration} seconds, taskId: ${taskId || 'none'}`);
  if (nextBreakDuration) {
    console.log(`[MainTimer] Next break duration will be: ${nextBreakDuration} minutes`);
  }

  // Update tray immediately
  const prefix = timerType === 'break' ? 'Break ' : '';
  updateTray(prefix + formatTrayTime(duration));

  // Write initial state to DB for Raycast
  writeTimerState();

  // Create interval in main process (won't be throttled)
  state.intervalId = setInterval(() => {
    tick();
  }, 1000);
}

function tick() {
  if (state.remainingSeconds <= 0) {
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
  state.status = 'idle';
  state.remainingSeconds = 0;
  state.startTime = null;
  state.currentTaskId = null;
  state.totalDuration = 0;
  state.paused = false;
  state.nextBreakDuration = undefined; // Clear for next session

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
  }
}

export function resumeTimer() {
  if (state.status !== 'idle' && !state.intervalId) {
    console.log('[MainTimer] Resuming timer');
    state.paused = false;
    writeTimerState();
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

  state.status = 'idle';
  state.remainingSeconds = 0;
  state.startTime = null;
  state.currentTaskId = null;
  state.totalDuration = 0;
  state.paused = false;

  updateTray('Ready');
  writeTimerState();
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

    // Notify renderer
    sendToRenderer('timer-extended', state.remainingSeconds);
  }
}

// Cleanup on app quit
export function cleanupTimer() {
  if (state.intervalId) {
    console.log('[MainTimer] Cleaning up timer interval');
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
}

import { BrowserWindow } from 'electron';
import { updateTray } from './tray';

interface TimerState {
  status: 'idle' | 'focus' | 'break';
  remainingSeconds: number;
  intervalId: NodeJS.Timeout | null;
  startTime: Date | null;
  nextBreakDuration?: 5 | 10; // Duration in minutes for next break
}

const state: TimerState = {
  status: 'idle',
  remainingSeconds: 0,
  intervalId: null,
  startTime: null,
};

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

export function startTimer(duration: number, timerType: 'focus' | 'break', nextBreakDuration?: 5 | 10) {
  // Clear any existing interval
  if (state.intervalId) {
    console.log('[MainTimer] Clearing existing interval before starting new timer');
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  state.status = timerType;
  state.remainingSeconds = duration;
  state.startTime = new Date();
  state.nextBreakDuration = nextBreakDuration;

  console.log(`[MainTimer] Starting ${timerType} timer for ${duration} seconds`);
  if (nextBreakDuration) {
    console.log(`[MainTimer] Next break duration will be: ${nextBreakDuration} minutes`);
  }

  // Update tray immediately
  const prefix = timerType === 'break' ? 'Break ' : '';
  updateTray(prefix + formatTrayTime(duration));

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

  // Update tray
  const prefix = state.status === 'break' ? 'Break ' : '';
  updateTray(prefix + formatTrayTime(state.remainingSeconds));

  // Notify renderer of time update
  sendToRenderer('timer-tick', state.remainingSeconds);
}

function handleComplete() {
  // Clear interval
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  const completedType = state.status;

  // Update tray with appropriate message
  if (completedType === 'focus' && state.nextBreakDuration) {
    // Focus session complete - suggest break with duration
    updateTray(`${state.nextBreakDuration}m Break`);
    console.log(`[MainTimer] Focus complete - suggesting ${state.nextBreakDuration}m break`);
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
  state.nextBreakDuration = undefined; // Clear for next session

  // Notify renderer
  sendToRenderer('timer-complete', completedType);

  console.log(`[MainTimer] ${completedType} complete notification sent to renderer`);
}

export function pauseTimer() {
  if (state.intervalId) {
    console.log('[MainTimer] Pausing timer');
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
}

export function resumeTimer() {
  if (state.status !== 'idle' && !state.intervalId) {
    console.log('[MainTimer] Resuming timer');
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

  updateTray('Ready');
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

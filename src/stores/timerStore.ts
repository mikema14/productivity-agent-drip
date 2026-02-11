import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TimerState } from '../types';
import { formatTrayTime, getCurrentDate, formatDateTime } from '../utils/time';
import {
  notifySessionComplete,
  notifyBreakComplete,
  notifyLongBreak
} from '../utils/notifications';

interface TimerStore extends TimerState {
  intervalId: number | null;
  sessionStartTime: Date | null;
  timerMode: 'pomodoro' | 'stopwatch';
  sessionViewMode: 'flat' | 'grouped';
  lastTaskId: string | null;
  lastTaskTitle: string | null;
  setTimerMode: (mode: 'pomodoro' | 'stopwatch') => void;
  setSessionViewMode: (mode: 'flat' | 'grouped') => void;
}

const FOCUS_DURATION = 25 * 60; // 25 minutes in seconds
const SHORT_BREAK_DURATION = 5 * 60; // 5 minutes in seconds
const LONG_BREAK_DURATION = 10 * 60; // 10 minutes in seconds
const SESSIONS_UNTIL_LONG_BREAK = 3;

export const useTimerStore = create<TimerStore>()(
  persist(
    (set, get) => ({
      status: 'idle',
      remainingSeconds: FOCUS_DURATION,
      totalDuration: FOCUS_DURATION,
      currentTaskId: null,
      sessionCount: 0,
      isPaused: false,
      intervalId: null,
      sessionStartTime: null,
      intention: '',
      showCompletionModal: false,
      timerMode: 'pomodoro',
      sessionViewMode: 'flat',
      lastTaskId: null,
      lastTaskTitle: null,

      setIntention: (intention: string) => {
        set({ intention });
      },

      setShowCompletionModal: (show: boolean) => {
        set({ showCompletionModal: show });
      },

      setTimerMode: (mode: 'pomodoro' | 'stopwatch') => {
        set({ timerMode: mode });
      },

      setSessionViewMode: (mode: 'flat' | 'grouped') => {
        set({ sessionViewMode: mode });
      },

  startFocus: async (taskId?: string) => {
    const state = get();

    // CRITICAL: Always clear existing interval before creating new one
    if (state.intervalId) {
      console.log('[Timer] Clearing existing focus interval:', state.intervalId);
      clearInterval(state.intervalId);
      set({ intervalId: null });
    }

    const now = new Date();

    // Calculate next break duration based on session count
    const nextSessionCount = state.sessionCount + 1;
    const isLongBreak = nextSessionCount % SESSIONS_UNTIL_LONG_BREAK === 0;
    const nextBreakDuration = isLongBreak ? 10 : 5;

    console.log('[Timer] Starting focus session via main process for task:', taskId || 'none');
    console.log('[Timer] Next break will be:', nextBreakDuration, 'minutes', isLongBreak ? '(long break)' : '(short break)');

    // Start timer in main process (won't be throttled when window is hidden)
    try {
      await window.timerAPI.startMainTimer(FOCUS_DURATION, 'focus', nextBreakDuration);
    } catch (error) {
      console.error('[Timer] Failed to start main process timer:', error);
      return;
    }

    set({
      status: 'focus',
      remainingSeconds: FOCUS_DURATION,
      totalDuration: FOCUS_DURATION,
      currentTaskId: taskId || null,
      isPaused: false,
      intervalId: 999999, // Dummy ID to indicate timer is running (actual timer in main process)
      sessionStartTime: now
    });
  },

  startBreak: async (isLong: boolean) => {
    const state = get();

    // CRITICAL: Always clear existing interval before creating new one
    if (state.intervalId) {
      console.log('[Timer] Clearing existing break interval:', state.intervalId);
      clearInterval(state.intervalId);
      set({ intervalId: null });
    }

    const duration = isLong ? LONG_BREAK_DURATION : SHORT_BREAK_DURATION;

    console.log('[Timer] Starting', isLong ? 'long' : 'short', 'break via main process');

    // Start timer in main process
    try {
      await window.timerAPI.startMainTimer(duration, 'break');
    } catch (error) {
      console.error('[Timer] Failed to start main process break timer:', error);
      return;
    }

    set({
      status: 'break',
      remainingSeconds: duration,
      totalDuration: duration,
      isPaused: false,
      intervalId: 999999, // Dummy ID
      sessionStartTime: new Date()
    });

    // Show notification
    if (isLong) {
      notifyLongBreak();
    }
  },

  tick: () => {
    // NOTE: This function is deprecated and should not be called.
    // Timer ticking now happens in the main process (electron/timer.ts)
    // Keeping this for backwards compatibility but logging warning if called
    console.warn('[Timer] tick() called but should not be - timer runs in main process now');
    return;
  },

  handleFocusComplete: async () => {
    const state = get();

    // Guard against duplicate calls - if session already completed, skip
    if (state.status === 'idle' || !state.sessionStartTime) {
      console.log('[Timer] handleFocusComplete called but session already completed, skipping');
      return;
    }

    console.log('[Timer] Focus session complete');

    // Stop main timer (if not already stopped)
    try {
      await window.timerAPI.stopMainTimer();
    } catch (error) {
      console.error('[Timer] Failed to stop main timer:', error);
    }

    // Clear interval if any
    if (state.intervalId) {
      clearInterval(state.intervalId);
      set({ intervalId: null });
    }

    // Determine comment priority: intention > task title > default
    let comment = state.intention.trim() || 'Focus session';

    // Save session to database
    if (window.timerAPI && state.sessionStartTime) {
      console.log('[Timer] Saving session to database...');
      const endTime = new Date();
      await window.timerAPI.saveSession({
        start_at: formatDateTime(state.sessionStartTime),
        end_at: formatDateTime(endTime),
        duration_minutes: 25,
        task_id: state.currentTaskId,
        source: 'pomodoro',
        comment,
        logged: 0,
        log_sent_at: null,
        server_entry_id: null
      });
    }

    // Increment session count
    const newSessionCount = state.sessionCount + 1;

    // Show notification
    notifySessionComplete();

    // Save last task for "Continue" feature - get task title from cache
    let taskTitle = null;
    if (state.currentTaskId && window.logAPI) {
      try {
        const cachedTask = await window.logAPI.getCachedTask(state.currentTaskId);
        taskTitle = cachedTask?.title || null;
      } catch (error) {
        console.error('Failed to get task title:', error);
      }
    }

    // Update state - keep taskId and intention for modal
    set({
      sessionCount: newSessionCount,
      intervalId: null,
      sessionStartTime: null,
      status: 'idle',
      remainingSeconds: FOCUS_DURATION,
      totalDuration: FOCUS_DURATION,
      isPaused: false,
      showCompletionModal: true, // SHOW MODAL instead of auto-starting break
      lastTaskId: state.currentTaskId,
      lastTaskTitle: taskTitle,
    });

    // Update tray
    if (window.timerAPI) {
      window.timerAPI.updateTrayTime('Ready');
    }
  },

  handleBreakComplete: async () => {
    const state = get();

    // Guard against duplicate calls - if already idle, skip
    if (state.status === 'idle') {
      console.log('[Timer] handleBreakComplete called but already idle, skipping');
      return;
    }

    console.log('[Timer] Break complete');

    // Stop main timer (if not already stopped)
    try {
      await window.timerAPI.stopMainTimer();
    } catch (error) {
      console.error('[Timer] Failed to stop main timer:', error);
    }

    // Clear interval if any
    if (state.intervalId) {
      clearInterval(state.intervalId);
      set({ intervalId: null });
    }

    // Save break session to database
    if (window.timerAPI && state.sessionStartTime) {
      const endTime = new Date();
      const durationMs = endTime.getTime() - state.sessionStartTime.getTime();
      const durationMinutes = Math.round(durationMs / 60000);

      if (durationMinutes >= 1) {
        try {
          await window.timerAPI.saveSession({
            start_at: formatDateTime(state.sessionStartTime),
            end_at: formatDateTime(endTime),
            duration_minutes: durationMinutes,
            task_id: null,
            source: 'break',
            comment: 'Break',
            logged: 0,
            log_sent_at: null,
            server_entry_id: null
          });
        } catch (error) {
          console.error('[Timer] Failed to save break session:', error);
        }
      }
    }

    // Show notification
    notifyBreakComplete();

    // Reset to idle
    set({
      status: 'idle',
      remainingSeconds: FOCUS_DURATION,
      totalDuration: FOCUS_DURATION,
      intervalId: null,
      isPaused: false,
      sessionStartTime: null
    });
  },

  pause: async () => {
    try {
      await window.timerAPI.pauseMainTimer();
      set({ isPaused: true });
    } catch (error) {
      console.error('[Timer] Failed to pause main timer:', error);
    }
  },

  resume: async () => {
    try {
      await window.timerAPI.resumeMainTimer();
      set({ isPaused: false });
    } catch (error) {
      console.error('[Timer] Failed to resume main timer:', error);
    }
  },

  skip: async () => {
    const state = get();

    console.log('[Timer] Skipping', state.status);

    // Stop main process timer
    try {
      await window.timerAPI.stopMainTimer();
    } catch (error) {
      console.error('[Timer] Failed to stop main timer during skip:', error);
    }

    // Clear interval if any
    if (state.intervalId) {
      clearInterval(state.intervalId);
      set({ intervalId: null });
    }

    if (state.status === 'focus') {
      // Skip to break
      const isLongBreak =
        (state.sessionCount + 1) % SESSIONS_UNTIL_LONG_BREAK === 0;
      set({ sessionCount: state.sessionCount + 1 });
      get().startBreak(isLongBreak);
    } else if (state.status === 'break') {
      // Skip break, go to idle
      get().reset();
    }
  },

  finishEarly: async () => {
    const { status, sessionStartTime, currentTaskId, sessionCount, intervalId, intention } = get();

    if (status !== 'focus') {
      console.warn('[Timer] Can only finish early during focus session');
      return;
    }

    if (!sessionStartTime) {
      console.warn('[Timer] No session start time available');
      return;
    }

    console.log('[Timer] Finishing session early');

    // Stop main process timer
    try {
      await window.timerAPI.stopMainTimer();
    } catch (error) {
      console.error('[Timer] Failed to stop main timer during finishEarly:', error);
    }

    // Clear interval if any
    if (intervalId) {
      clearInterval(intervalId);
      set({ intervalId: null });
    }

    const now = new Date();
    const elapsedMs = now.getTime() - sessionStartTime.getTime();
    const elapsedMinutes = Math.ceil(elapsedMs / 60000); // Round up

    // Don't save sessions under 1 minute
    if (elapsedMinutes < 1) {
      console.warn('Session too short to save');
      window.timerAPI.showNotification(
        'Session Too Short',
        'Sessions must be at least 1 minute to save'
      );
      get().reset();
      return;
    }

    // Determine comment: intention > early finish message
    const comment = intention.trim() || `Finished early (${elapsedMinutes}m)`;

    // Create session with actual elapsed time
    const session = {
      start_at: sessionStartTime.toISOString(),
      end_at: now.toISOString(),
      duration_minutes: elapsedMinutes,
      task_id: currentTaskId || null,
      source: 'pomodoro' as const,
      comment,
      logged: 0 as 0 | 1,
      billable: 1 as 0 | 1, // Default, user can edit later
    };

    try {
      await window.timerAPI.saveSession(session);

      // Show notification
      window.timerAPI.showNotification(
        'Session Complete',
        `${elapsedMinutes} minutes logged. Time for a break!`
      );

      // Increment session count
      const newCount = sessionCount + 1;
      const isLongBreak = newCount % SESSIONS_UNTIL_LONG_BREAK === 0;

      // Update state and clear intention
      set({
        status: 'idle',
        remainingSeconds: FOCUS_DURATION,
        totalDuration: FOCUS_DURATION,
        sessionCount: newCount,
        intention: '',
        isPaused: false,
        intervalId: null,
        sessionStartTime: null,
      });

      // Update tray
      if (window.timerAPI) {
        window.timerAPI.updateTrayTime('Ready');
      }

      // TODO: Auto-start break if enabled in settings
      // For now, user can manually start break

    } catch (error) {
      console.error('Failed to save early-finish session:', error);
      window.timerAPI.showNotification('Error', 'Failed to save session');
      get().reset();
    }
  },

  reset: async () => {
    const state = get();

    console.log('[Timer] Resetting timer - stopping main process timer');

    // Stop main process timer
    try {
      await window.timerAPI.stopMainTimer();
    } catch (error) {
      console.error('[Timer] Failed to stop main timer:', error);
    }

    // Clear interval if any
    if (state.intervalId) {
      clearInterval(state.intervalId);
    }

    set({
      status: 'idle',
      remainingSeconds: FOCUS_DURATION,
      totalDuration: FOCUS_DURATION,
      currentTaskId: null,
      isPaused: false,
      intervalId: null,
      sessionStartTime: null
    });
  },

  continueFromModal: () => {
    const state = get();
    set({ showCompletionModal: false });
    // Reuse existing startFocus with current taskId
    get().startFocus(state.currentTaskId || undefined);
  },

  startBreakFromModal: () => {
    const state = get();
    set({ showCompletionModal: false, intention: '' }); // Clear intention on break

    // Determine break type
    const isLongBreak = state.sessionCount % SESSIONS_UNTIL_LONG_BREAK === 0;
    get().startBreak(isLongBreak);
  },

  extendSession: async (minutes: number) => {
    const state = get();
    if (state.status === 'focus') {
      try {
        await window.timerAPI.extendMainTimer(minutes * 60);
        // The main process will send us an update via timer-extended event
      } catch (error) {
        console.error('[Timer] Failed to extend main timer:', error);
      }
    }
  },
}),
    {
      name: 'timer-storage',
      partialize: (state) => ({
        timerMode: state.timerMode,
        sessionViewMode: state.sessionViewMode,
        lastTaskId: state.lastTaskId,
        lastTaskTitle: state.lastTaskTitle,
        intention: state.intention,
      }),
    }
  )
);

// Helper function to load session count from settings on app start
export async function loadSessionCount() {
  if (window.timerAPI) {
    const today = getCurrentDate();
    const savedDate = await window.timerAPI.getSettings('lastSessionDate');

    if (savedDate === today) {
      const count = await window.timerAPI.getSettings('sessionCount');
      if (count) {
        useTimerStore.setState({ sessionCount: parseInt(count, 10) });
      }
    } else {
      // New day, reset counter
      useTimerStore.setState({ sessionCount: 0 });
      await window.timerAPI.saveSettings('lastSessionDate', today);
      await window.timerAPI.saveSettings('sessionCount', '0');
    }
  }
}

// Save session count periodically
export async function saveSessionCount() {
  if (window.timerAPI) {
    const count = useTimerStore.getState().sessionCount;
    await window.timerAPI.saveSettings('sessionCount', count.toString());
  }
}

// Cleanup function to clear any running intervals
export function cleanupTimerIntervals() {
  const state = useTimerStore.getState();
  if (state.intervalId) {
    console.log('Cleaning up timer interval:', state.intervalId);
    clearInterval(state.intervalId);
    useTimerStore.setState({ intervalId: null });
  }
}

// Hydration check - fixes stuck timer states on app restart
export function checkTimerHydration() {
  const state = useTimerStore.getState();

  // If timer appears to be running (focus or break status) but has no interval,
  // it means the app was closed/restarted while timer was active
  if ((state.status === 'focus' || state.status === 'break') && !state.intervalId) {
    console.warn('Timer was in running state without interval - resetting to idle');
    useTimerStore.setState({
      status: 'idle',
      remainingSeconds: FOCUS_DURATION,
      totalDuration: FOCUS_DURATION,
      isPaused: false,
      intervalId: null,
      sessionStartTime: null,
    });

    // Update tray
    if (window.timerAPI) {
      window.timerAPI.updateTrayTime('Ready');
    }
  }
}

// Track if listeners are already set up to prevent duplicates
let listenersSetup = false;

// Setup event listeners from main process timer
export function setupMainTimerListeners() {
  if (!window.timerAPI) return;

  // Prevent setting up listeners multiple times
  if (listenersSetup) {
    console.log('[Timer] Listeners already setup, skipping duplicate registration');
    return;
  }

  console.log('[Timer] Setting up main timer listeners');
  listenersSetup = true;

  // Listen for tick events from main process
  window.timerAPI.onTimerTick((remainingSeconds: number) => {
    useTimerStore.setState({ remainingSeconds });
  });

  // Listen for timer complete events
  window.timerAPI.onTimerComplete((timerType: 'focus' | 'break') => {
    console.log('[Timer] Received complete event from main process:', timerType);
    const state = useTimerStore.getState();

    if (timerType === 'focus') {
      state.handleFocusComplete();
    } else if (timerType === 'break') {
      state.handleBreakComplete();
    }
  });

  // Listen for timer extension events
  window.timerAPI.onTimerExtended((newRemaining: number) => {
    console.log('[Timer] Received extended event from main process, new remaining:', newRemaining);
    const state = useTimerStore.getState();
    // Update totalDuration to account for extension (add the difference)
    const extended = newRemaining - state.remainingSeconds;
    useTimerStore.setState({
      remainingSeconds: newRemaining,
      totalDuration: state.totalDuration + extended,
    });
  });
}

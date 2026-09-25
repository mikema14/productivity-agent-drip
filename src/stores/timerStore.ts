import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BreakCompletePayload, FocusCompletePayload, TimerState } from '../types';
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
  durationMinutes: number;
  setTimerMode: (mode: 'pomodoro' | 'stopwatch') => void;
  setSessionViewMode: (mode: 'flat' | 'grouped') => void;
  setDurationMinutes: (minutes: number) => void;
  /**
   * Set while the session is a kickoff: 'warmup' for its short opening,
   * 'rolled' once it has extended itself into a full focus session.
   */
  kickoff: 'warmup' | 'rolled' | null;
  /** `kickoffSeconds` turns the session into a kickoff of that length. */
  startFocus: (taskId?: string, billable?: boolean, fromOverlay?: boolean, kickoffSeconds?: number) => Promise<void>;
  startKickoff: (seconds: number) => Promise<void>;
  stopKickoff: () => Promise<void>;
}

const DEFAULT_DURATION_MINUTES = 25;

/** Comment on a kickoff session with no intention, so it can be told apart. */
const KICKOFF_COMMENT = 'Kickoff';

/**
 * The task a kickoff (or the idle nudge's Start focus) attaches to: the
 * current one, else today's most recent session with a task, else the last
 * finished one.
 */
async function resolveLastTaskId(state: { currentTaskId: string | null; lastTaskId: string | null }): Promise<string | undefined> {
  if (state.currentTaskId) return state.currentTaskId;
  try {
    const session = await window.timerAPI.getLastSessionWithTask(getCurrentDate());
    if (session?.task_id) return session.task_id;
  } catch (error) {
    console.error('[Timer] Failed to look up last session task:', error);
  }
  return state.lastTaskId || undefined;
}

const SESSIONS_UNTIL_LONG_BREAK = 3;

function getBreakSeconds(durationMinutes: number, isLong: boolean): number {
  const shortSecs = Math.max(60, Math.round((durationMinutes / 5) * 60));
  return isLong ? shortSecs * 2 : shortSecs;
}

function getBreakMinutes(durationMinutes: number, isLong: boolean): number {
  return Math.max(1, Math.round(getBreakSeconds(durationMinutes, isLong) / 60));
}

async function resolveTaskTitle(taskId: string | null): Promise<string | null> {
  if (!taskId || !window.logAPI) return null;
  try {
    const cachedTask = await window.logAPI.getCachedTask(taskId);
    return cachedTask?.title || null;
  } catch (error) {
    console.error('Failed to get task title:', error);
    return null;
  }
}

/**
 * Raise the always-on-top overlay and return whether its window went up. The
 * notification always fires as well: `shown` only means the window was created,
 * not that it landed somewhere the user can see. The overlay sits below the
 * macOS banner band, so the two don't cover each other.
 */
async function raiseSessionEndOverlay(
  payload: FocusCompletePayload | BreakCompletePayload,
  notify: () => void
): Promise<boolean> {
  let shown = false;

  try {
    const result = await window.timerAPI.showSessionOverlay(payload);
    shown = result.shown;
  } catch (error) {
    console.error('[Timer] Failed to show session overlay:', error);
  }

  notify();
  return shown;
}

export const useTimerStore = create<TimerStore>()(
  persist(
    (set, get) => ({
      status: 'idle',
      remainingSeconds: DEFAULT_DURATION_MINUTES * 60,
      totalDuration: DEFAULT_DURATION_MINUTES * 60,
      currentTaskId: null,
      currentBillable: true,
      sessionCount: 0,
      isPaused: false,
      intervalId: null,
      sessionStartTime: null,
      intention: '',
      overlayOpen: false,
      timerMode: 'pomodoro',
      sessionViewMode: 'flat',
      lastTaskId: null,
      lastTaskTitle: null,
      durationMinutes: DEFAULT_DURATION_MINUTES,
      kickoff: null,

      setIntention: (intention: string) => {
        set({ intention });
      },

      setTimerMode: (mode: 'pomodoro' | 'stopwatch') => {
        set({ timerMode: mode });
      },

      setSessionViewMode: (mode: 'flat' | 'grouped') => {
        set({ sessionViewMode: mode });
      },

      setDurationMinutes: (minutes: number) => {
        const secs = minutes * 60;
        set({ durationMinutes: minutes, remainingSeconds: secs, totalDuration: secs });
      },

      setCurrentBillable: (billable: boolean) => {
        set({ currentBillable: billable });
      },

  startFocus: async (taskId?: string, billable?: boolean, fromOverlay?: boolean, kickoffSeconds?: number) => {
    const state = get();

    if (state.overlayOpen && !fromOverlay) {
      void window.timerAPI?.hideSessionOverlay();
    }
    set({ overlayOpen: false });

    if (state.intervalId) {
      clearInterval(state.intervalId);
      set({ intervalId: null });
    }

    // Resolve the billable default for this task unless the caller passed an explicit value.
    let resolvedBillable = billable ?? state.currentBillable;
    if (billable === undefined && window.listsAPI?.getBillableForTask) {
      try {
        resolvedBillable = await window.listsAPI.getBillableForTask(taskId || null);
      } catch (error) {
        console.error('[Timer] Failed to resolve billable default:', error);
      }
    }

    const now = new Date();
    const focusSecs = state.durationMinutes * 60;
    // A kickoff runs its short opening, then main extends it by focusSecs.
    const kickoffSecs = kickoffSeconds && kickoffSeconds > 0 ? kickoffSeconds : 0;
    const timerSecs = kickoffSecs || focusSecs;
    const nextSessionCount = state.sessionCount + 1;
    const isLongBreak = nextSessionCount % SESSIONS_UNTIL_LONG_BREAK === 0;
    const nextBreakMins = getBreakMinutes(state.durationMinutes, isLongBreak) as 5 | 10;

    try {
      await window.timerAPI.startMainTimer(
        timerSecs,
        'focus',
        nextBreakMins,
        taskId || undefined,
        kickoffSecs ? focusSecs : undefined
      );
    } catch (error) {
      console.error('[Timer] Failed to start main process timer:', error);
      return;
    }

    set({
      status: 'focus',
      remainingSeconds: timerSecs,
      totalDuration: timerSecs,
      currentTaskId: taskId || null,
      currentBillable: resolvedBillable,
      isPaused: false,
      intervalId: 999999,
      sessionStartTime: now,
      kickoff: kickoffSecs ? 'warmup' : null
    });
  },

  startKickoff: async (seconds: number) => {
    const state = get();
    if (state.status === 'focus') return;
    const taskId = await resolveLastTaskId(state);
    await get().startFocus(taskId, undefined, false, seconds);
  },

  /** "Stop" on the kickoff prompt: end it and keep what ran as its own session. */
  stopKickoff: async () => {
    const { status, kickoff, sessionStartTime, currentTaskId, currentBillable, intention } = get();
    if (status !== 'focus' || !kickoff || !sessionStartTime) return;

    try {
      await window.timerAPI.stopMainTimer();
    } catch (error) {
      console.error('[Timer] Failed to stop main timer for kickoff:', error);
    }

    const endTime = new Date();
    const minutes = Math.max(1, Math.round((endTime.getTime() - sessionStartTime.getTime()) / 60000));
    try {
      await window.timerAPI.saveSession({
        start_at: formatDateTime(sessionStartTime),
        end_at: formatDateTime(endTime),
        duration_minutes: minutes,
        task_id: currentTaskId,
        source: 'pomodoro',
        comment: intention.trim() || KICKOFF_COMMENT,
        logged: 0,
        log_sent_at: null,
        server_entry_id: null,
        billable: currentBillable ? 1 : 0
      });
    } catch (error) {
      console.error('[Timer] Failed to save kickoff session:', error);
    }

    const focusSecs = get().durationMinutes * 60;
    set({
      status: 'idle',
      remainingSeconds: focusSecs,
      totalDuration: focusSecs,
      isPaused: false,
      intervalId: null,
      sessionStartTime: null,
      kickoff: null,
      lastTaskId: currentTaskId ?? get().lastTaskId
    });
    window.timerAPI.updateTrayTime('Ready');
  },

  startBreak: async (isLong: boolean, fromOverlay?: boolean) => {
    const state = get();

    const keepOverlay = !!fromOverlay;
    if (state.overlayOpen && !keepOverlay) {
      void window.timerAPI?.hideSessionOverlay();
      set({ overlayOpen: false });
    }

    if (state.intervalId) {
      clearInterval(state.intervalId);
      set({ intervalId: null });
    }

    const duration = getBreakSeconds(state.durationMinutes, isLong);

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
      intervalId: 999999,
      sessionStartTime: new Date(),
      kickoff: null
    });

    // Give the overlay's break pill its real progress denominator
    if (keepOverlay) {
      void window.timerAPI?.notifyBreakStarted(duration, isLong);
    }

    // The overlay's break pill already labels a long break
    if (isLong && !keepOverlay) {
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
    let comment = state.intention.trim() || (state.kickoff ? KICKOFF_COMMENT : 'Focus session');
    // A kickoff extended itself, so its length is the whole run, not the setting.
    const sessionMinutes = state.kickoff
      ? Math.max(1, Math.round(state.totalDuration / 60))
      : state.durationMinutes;

    // Save session to database
    const endTime = new Date();
    let sessionId: string | null = null;
    if (window.timerAPI && state.sessionStartTime) {
      console.log('[Timer] Saving session to database...');
      sessionId = await window.timerAPI.saveSession({
        start_at: formatDateTime(state.sessionStartTime),
        end_at: formatDateTime(endTime),
        duration_minutes: sessionMinutes,
        task_id: state.currentTaskId,
        source: 'pomodoro',
        comment,
        logged: 0,
        log_sent_at: null,
        server_entry_id: null,
        billable: state.currentBillable ? 1 : 0
      });
    }

    // Increment session count
    const newSessionCount = state.sessionCount + 1;

    // Save last task for "Continue" feature - get task title from cache
    const taskTitle = await resolveTaskTitle(state.currentTaskId);

    // Raise the always-on-top overlay. It works whether or not the main window
    // is visible, which the old in-window modal did not.
    const isLongBreak = newSessionCount % SESSIONS_UNTIL_LONG_BREAK === 0;
    const overlayShown = await raiseSessionEndOverlay(
      {
        kind: 'focus-complete',
        sessionId,
        taskId: state.currentTaskId,
        taskTitle,
        durationMinutes: sessionMinutes,
        startedAt: state.sessionStartTime.toISOString(),
        endedAt: endTime.toISOString(),
        note: state.intention.trim(),
        nextBreakMinutes: getBreakMinutes(state.durationMinutes, isLongBreak),
        isLongBreak,
      },
      notifySessionComplete
    );

    const focusSecs = state.durationMinutes * 60;
    set({
      sessionCount: newSessionCount,
      intervalId: null,
      sessionStartTime: null,
      status: 'idle',
      remainingSeconds: focusSecs,
      totalDuration: focusSecs,
      isPaused: false,
      overlayOpen: overlayShown,
      lastTaskId: state.currentTaskId,
      lastTaskTitle: taskTitle,
      kickoff: null,
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

    const breakOverlayShown = await raiseSessionEndOverlay(
      { kind: 'break-complete', nextFocusMinutes: get().durationMinutes },
      notifyBreakComplete
    );

    const focusSecs = get().durationMinutes * 60;
    set({
      overlayOpen: breakOverlayShown,
      status: 'idle',
      remainingSeconds: focusSecs,
      totalDuration: focusSecs,
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
    const { status, sessionStartTime, currentTaskId, currentBillable, sessionCount, intervalId, intention, kickoff } = get();

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
    const comment = intention.trim() || (kickoff ? KICKOFF_COMMENT : `Finished early (${elapsedMinutes}m)`);

    // Create session with actual elapsed time
    const session = {
      start_at: sessionStartTime.toISOString(),
      end_at: now.toISOString(),
      duration_minutes: elapsedMinutes,
      task_id: currentTaskId || null,
      source: 'pomodoro' as const,
      comment,
      logged: 0 as 0 | 1,
      billable: (currentBillable ? 1 : 0) as 0 | 1,
    };

    try {
      const sessionId = await window.timerAPI.saveSession(session);

      // Increment session count
      const newCount = sessionCount + 1;
      const isLongBreak = newCount % SESSIONS_UNTIL_LONG_BREAK === 0;

      const taskTitle = await resolveTaskTitle(currentTaskId);

      const earlyOverlayShown = await raiseSessionEndOverlay(
        {
          kind: 'focus-complete',
          sessionId,
          taskId: currentTaskId || null,
          taskTitle,
          durationMinutes: elapsedMinutes,
          startedAt: sessionStartTime.toISOString(),
          endedAt: now.toISOString(),
          note: intention.trim(),
          nextBreakMinutes: getBreakMinutes(get().durationMinutes, isLongBreak),
          isLongBreak,
        },
        () =>
          window.timerAPI.showNotification(
            'Session Complete',
            `${elapsedMinutes} minutes logged. Time for a break!`
          )
      );

      const focusSecs2 = get().durationMinutes * 60;
      set({
        status: 'idle',
        remainingSeconds: focusSecs2,
        totalDuration: focusSecs2,
        sessionCount: newCount,
        intention: '',
        isPaused: false,
        intervalId: null,
        sessionStartTime: null,
        overlayOpen: earlyOverlayShown,
        kickoff: null,
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

    const focusSecs3 = get().durationMinutes * 60;
    set({
      status: 'idle',
      remainingSeconds: focusSecs3,
      totalDuration: focusSecs3,
      currentTaskId: null,
      isPaused: false,
      intervalId: null,
      sessionStartTime: null,
      kickoff: null
    });
  },

  continueFromModal: (fromOverlay?: boolean) => {
    const state = get();
    set({ overlayOpen: false });
    // Reuse existing startFocus with current taskId
    get().startFocus(state.currentTaskId || undefined, undefined, fromOverlay);
  },

  dismissCompletionModal: () => {
    const focusSecs4 = get().durationMinutes * 60;
    set({
      overlayOpen: false,
      intention: '',
      status: 'idle',
      remainingSeconds: focusSecs4,
      totalDuration: focusSecs4,
      currentTaskId: null,
      isPaused: false,
      intervalId: null,
      sessionStartTime: null,
    });
    if (window.timerAPI) {
      window.timerAPI.updateTrayTime('Ready');
    }
  },

  startBreakFromModal: (fromOverlay?: boolean) => {
    const state = get();
    set({ intention: '' }); // Clear intention on break

    // Determine break type
    const isLongBreak = state.sessionCount % SESSIONS_UNTIL_LONG_BREAK === 0;
    // The overlay stays up and collapses into the break pill.
    get().startBreak(isLongBreak, fromOverlay || state.overlayOpen);
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
        durationMinutes: state.durationMinutes,
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
    const hydrateSecs = (state.durationMinutes || DEFAULT_DURATION_MINUTES) * 60;
    useTimerStore.setState({
      status: 'idle',
      remainingSeconds: hydrateSecs,
      totalDuration: hydrateSecs,
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
      // The roll-over is the extension that arrives at zero; a manual +5m
      // during the warmup is not.
      kickoff: state.kickoff === 'warmup' && state.remainingSeconds <= 1 ? 'rolled' : state.kickoff,
    });
  });

  // The main-process idle watcher: the red nudge's Start focus, the kickoff
  // (takeover, nudge button or drip://kickoff), and Stop on the kickoff prompt.
  window.timerAPI.onIdleCommand?.((command) => {
    console.log('[Timer] Idle command received:', command);
    const state = useTimerStore.getState();
    if (command.type === 'start-focus') {
      if (state.status === 'focus') return;
      void resolveLastTaskId(state).then((taskId) => useTimerStore.getState().startFocus(taskId));
    } else if (command.type === 'kickoff') {
      void state.startKickoff(command.seconds);
    } else if (command.type === 'stop-kickoff') {
      void state.stopKickoff();
    }
  });

  // Listen for URL scheme events (drip:// from Raycast)
  window.timerAPI.onUrlStartFocus((data) => {
    console.log('[Timer] URL start-focus received:', data);
    const state = useTimerStore.getState();
    if (state.status === 'idle') {
      if (data.intention) {
        state.setIntention(data.intention);
      }
      state.startFocus(data.taskId);
    }
  });

  // The overlay relays its buttons here so they drive the exact same actions
  // the app's own flow uses — the overlay never touches the timer directly.
  window.timerAPI.onOverlayAction((type) => {
    console.log('[Timer] Overlay action received:', type);
    const state = useTimerStore.getState();
    if (type === 'start-break') {
      state.startBreakFromModal(true);
    } else if (type === 'next-focus') {
      state.continueFromModal(true);
    } else {
      state.dismissCompletionModal();
    }
  });

  window.timerAPI.onUrlTimerAction((action, data) => {
    console.log('[Timer] URL timer action received:', action, data);
    const state = useTimerStore.getState();
    switch (action) {
      case 'pause': state.pause(); break;
      case 'resume': state.resume(); break;
      case 'stop': state.reset(); break;
      case 'finish-early': state.finishEarly(); break;
      case 'start-break': {
        if (state.overlayOpen) {
          state.startBreakFromModal();
        } else {
          state.startBreak(data?.isLong ?? false);
        }
        break;
      }
      case 'skip-break': {
        if (state.overlayOpen) {
          state.dismissCompletionModal();
        }
        break;
      }
    }
  });
}

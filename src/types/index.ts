// Core timer types
export type TimerStatus = 'idle' | 'focus' | 'break';

export interface TimerState {
  status: TimerStatus;
  remainingSeconds: number;
  currentTaskId: string | null;
  currentBillable: boolean;
  sessionCount: number;
  isPaused: boolean;
  intention: string;
  /** True while the always-on-top session-end overlay is up. */
  overlayOpen: boolean;
  durationMinutes: number;
  setIntention: (intention: string) => void;
  setDurationMinutes: (minutes: number) => void;
  setCurrentBillable: (billable: boolean) => void;
  startFocus: (taskId?: string, billable?: boolean, fromOverlay?: boolean) => Promise<void>;
  startBreak: (isLong: boolean, fromOverlay?: boolean) => void;
  tick: () => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  finishEarly: () => Promise<void>;
  reset: () => void;
  continueFromModal: (fromOverlay?: boolean) => void;
  startBreakFromModal: (fromOverlay?: boolean) => void;
  dismissCompletionModal: () => void;
  extendSession: (minutes: number) => void;
  totalDuration: number;
}

// Database types
export interface PomodoroSession {
  id: string;
  start_at: string; // ISO datetime
  end_at: string | null;
  duration_minutes: number;
  task_id: string | null;
  source: 'pomodoro' | 'manual' | 'calendar' | 'break';
  comment: string | null;
  logged: 0 | 1;
  log_sent_at: string | null;
  server_entry_id: number | null;
  billable?: 0 | 1;
}

export interface TaskCache {
  task_id: string;
  title: string;
  project_id: number;
  project_name: string | null;
  last_seen_at: string;
}

/** A cached task as shown in the Timer's recent list: frecency-ordered, with today's tracked time. */
export interface RankedTask extends TaskCache {
  /** Minutes tracked on this task today (sessions + adhoc entries + accepted calendar events). */
  todayMinutes: number;
}

export interface AdhocEntry {
  id: string;
  created_at: string;
  date: string; // YYYY-MM-DD
  duration_minutes: number;
  title: string;
  task_id: string | null;
  is_todo: 0 | 1;
  due_date: string | null;
  completed: 0 | 1;
  marked_to_log: 0 | 1;
  logged: 0 | 1;
  comment: string | null;
  billable?: 0 | 1;
  start_time: string | null;
}

export interface CalendarProposal {
  id: string;
  event_uid: string;
  title: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  date: string; // YYYY-MM-DD
  accepted: 0 | 1;
  dismissed: 0 | 1;
  task_id: string | null;
  comment: string | null;
  logged: 0 | 1;
  /** R7: added by migration; undefined on rows read before it ran (treated as billable). */
  billable?: 0 | 1;
}

export interface CalendarFeedResult {
  data: string;
  fetchedAt: number;
  fromCache: boolean;
}

export interface DailySummary {
  date: string; // YYYY-MM-DD
  payload: string; // JSON
  saved_at: string;
}

export interface Setting {
  key: string;
  value: string;
}

// Settings configuration
export interface AppSettings {
  apiBaseUrl: string;
  apiKey: string;
  calendarUrl: string;
  pomodoroFocus: number; // minutes
  pomodoroShortBreak: number; // minutes
  pomodoroLongBreak: number; // minutes
  sessionsUntilLongBreak: number;
  defaultBillable: boolean;
  roundingMode: 'none' | '5min' | '15min';
  showTrayIcon: boolean;
}

// API types
export interface IssueData {
  taskId: string;
  title: string;
  projectId: number;
  projectName: string;
}

export interface IssueResponse {
  issue: {
    id: number;
    subject: string;
    project: {
      id: number;
      name: string;
    };
    tracker?: { name: string };
    priority?: { name: string };
    assigned_to?: { id: number; name: string };
  };
}

export interface TimeEntryPayload {
  time_entry: {
    project_id: number;
    issue_id: number;
    user_id: number;
    activity_id: number;
    hours: number;
    spent_on: string; // YYYY-MM-DD
    comments: string;
    easy_is_billable: boolean;
  };
}

export interface LogEntry {
  id: string;
  date: string;
  hours: number;
  taskId: string;
  projectId: number;
  comment: string;
  billable: boolean;
}

export interface LogResult {
  success: number;
  failed: number;
  errors: Array<{ entryId: string; error: string }>;
}

// API test result type
export interface ApiTestResult {
  user: {
    id: number;
    login: string;
    firstname: string;
    lastname: string;
    mail: string;
  };
}

// Session-end overlay (always-on-top glass window)
export interface FocusCompletePayload {
  kind: 'focus-complete';
  sessionId: string | null;
  taskId: string | null;
  taskTitle: string | null;
  durationMinutes: number;
  startedAt: string;
  endedAt: string;
  note: string;
  nextBreakMinutes: number;
  isLongBreak: boolean;
}

export interface BreakCompletePayload {
  kind: 'break-complete';
  nextFocusMinutes: number;
}

export interface BreakRunningPayload {
  kind: 'break-running';
  totalSeconds: number;
  remainingSeconds: number;
  isLong: boolean;
}

/** Red nudge: the timer has been idle too long. Raised by the main-process idle watcher. */
export interface IdleNudgePayload {
  kind: 'idle';
  /** ISO time the idle clock started. */
  idleSince: string;
  /** ISO time the kickoff takes over if the nudge is ignored. */
  kickoffAt: string;
  kickoffSeconds: number;
  snoozeSeconds: number;
}

/** A kickoff just rolled over into a full focus session. */
export interface KickoffContinuePayload {
  kind: 'kickoff-continue';
  focusMinutes: number;
  /** The prompt hides itself after this long; no answer = keep going. */
  countdownSeconds: number;
}

export type SessionOverlayPayload =
  | FocusCompletePayload
  | BreakCompletePayload
  | BreakRunningPayload
  | IdleNudgePayload
  | KickoffContinuePayload;

export type OverlayActionType =
  | 'start-break'
  | 'next-focus'
  | 'dismiss'
  // Idle nudge
  | 'idle-start-focus'
  | 'idle-kickoff'
  | 'idle-snooze'
  // Kickoff roll-over prompt
  | 'kickoff-keep'
  | 'kickoff-stop';

/** Main → main-window renderer: the idle watcher asks the timer store to act. */
export type IdleCommand =
  | { type: 'start-focus' }
  | { type: 'kickoff'; seconds: number }
  | { type: 'stop-kickoff' };

export interface OverlayAPI {
  onState: (callback: (payload: SessionOverlayPayload) => void) => void;
  onTick: (callback: (remainingSeconds: number) => void) => void;
  action: (type: OverlayActionType) => void;
  saveNote: (sessionId: string, note: string) => Promise<void>;
  setInteractive: (interactive: boolean) => void;
  /** Escalation state — main owns the full-width top-edge attention strip. */
  setEscalated: (escalated: boolean) => void;
}

// IPC channel types
export interface TimerAPI {
  saveSession: (session: Omit<PomodoroSession, 'id'>) => Promise<string>;
  getSessions: (date: string) => Promise<PomodoroSession[]>;
  getLastSessionWithTask: (date: string) => Promise<PomodoroSession | null>;
  getSettings: (key: string) => Promise<string | null>;
  saveSettings: (key: string, value: string) => Promise<void>;
  updateTrayTime: (time: string) => void;
  showNotification: (title: string, body: string) => void;
  testApiConnection?: (baseUrl: string, apiKey: string) => Promise<ApiTestResult>;
  getIssue?: (baseUrl: string, apiKey: string, issueId: string) => Promise<IssueData>;
  postTimeEntry?: (baseUrl: string, apiKey: string, payload: TimeEntryPayload) => Promise<number>;
  fetchCalendarFeed?: (url: string, forceRefresh?: boolean) => Promise<CalendarFeedResult>;
  onCalendarFeedUpdated?: (callback: () => void) => () => void;
  getDaysSinceLastLog?: () => Promise<number | null>;
  openExternal?: (url: string) => Promise<void>;
  // Main process timer control
  startMainTimer: (duration: number, timerType: 'focus' | 'break', nextBreakDuration?: 5 | 10, taskId?: string, kickoffRolloverSeconds?: number) => Promise<void>;
  pauseMainTimer: () => Promise<void>;
  resumeMainTimer: () => Promise<void>;
  stopMainTimer: () => Promise<void>;
  getMainTimerState: () => Promise<{
    status: 'idle' | 'focus' | 'break';
    remainingSeconds: number;
    startTime: Date | null;
  }>;
  extendMainTimer: (additionalSeconds: number) => Promise<void>;
  onTimerTick: (callback: (remainingSeconds: number) => void) => void;
  onTimerComplete: (callback: (timerType: 'focus' | 'break') => void) => void;
  onTimerExtended: (callback: (newRemaining: number) => void) => void;
  onUrlStartFocus: (callback: (data: { taskId?: string; intention?: string }) => void) => void;
  onUrlTimerAction: (callback: (action: 'pause' | 'resume' | 'stop' | 'finish-early' | 'start-break' | 'skip-break', data?: any) => void) => void;
  toggleTray: (show: boolean) => Promise<void>;
  // Session-end overlay
  showSessionOverlay: (payload: FocusCompletePayload | BreakCompletePayload) => Promise<{ shown: boolean }>;
  hideSessionOverlay: () => Promise<void>;
  notifyBreakStarted: (totalSeconds: number, isLong: boolean) => Promise<void>;
  setOverlayEnabled: (enabled: boolean) => Promise<void>;
  onOverlayAction: (callback: (type: OverlayActionType) => void) => void;
  onIdleCommand: (callback: (command: IdleCommand) => void) => void;
}

export interface LogAPI {
  getSessions: (date: string) => Promise<PomodoroSession[]>;
  getSessionsInRange?: (startDate: string, endDate: string) => Promise<PomodoroSession[]>;
  updateSession: (id: string, updates: Partial<PomodoroSession>) => Promise<void>;
  deleteSession?: (id: string) => Promise<void>;
  getAdhocEntries: (date: string) => Promise<AdhocEntry[]>;
  getAdhocEntriesInRange?: (startDate: string, endDate: string) => Promise<AdhocEntry[]>;
  addAdhocEntry: (entry: Omit<AdhocEntry, 'id' | 'created_at'>) => Promise<string>;
  updateAdhocEntry: (id: string, updates: Partial<AdhocEntry>) => Promise<void>;
  deleteAdhocEntry: (id: string) => Promise<void>;
  getCalendarProposals: (date: string, includeAll?: boolean) => Promise<CalendarProposal[]>;
  addCalendarProposal?: (proposal: Omit<CalendarProposal, 'id'>) => Promise<string>;
  updateCalendarProposal?: (id: string, updates: Partial<CalendarProposal>) => Promise<void>;
  acceptCalendarProposal?: (id: string, taskId?: string) => Promise<void>;
  dismissCalendarProposal?: (id: string) => Promise<void>;
  getCachedTasks: () => Promise<TaskCache[]>;
  getCachedTask: (taskId: string) => Promise<TaskCache | null>;
  cacheTask?: (taskId: string, title: string, projectId: number, projectName: string) => Promise<void>;
  getRecentTasks: () => Promise<TaskCache[]>;
  /** Frecency-ranked recent tasks with today's tracked minutes. `today` is YYYY-MM-DD. */
  getRankedRecentTasks?: (limit: number, today: string) => Promise<RankedTask[]>;
  /** Tracked minutes per task id, inclusive YYYY-MM-DD range (Plan card annotations). */
  getTaskMinutesByRange?: (from: string, to: string) => Promise<Record<string, number>>;
  searchTasks: (query: string, limit?: number) => Promise<TaskCache[]>;
  getTemplates: () => Promise<LogTemplate[]>;
  addTemplate: (template: Omit<LogTemplate, 'id' | 'created_at'>) => Promise<string>;
  updateTemplate: (id: string, template: Omit<LogTemplate, 'id' | 'created_at'>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
}

export interface LogTemplate {
  id: string;
  name: string;
  task_id: string;
  default_duration: number | null;
  billable: number;
  comment?: string | null;
  created_at: string;
}

// Dashboard types
export interface TaskPreference {
  taskId: string;
  tracked: boolean;
  pinned: boolean;
  milestoneIds: string[];
  goalId?: string;
}

export interface Milestone {
  id: string;
  parentType: 'task' | 'goal';
  parentId: string;
  title: string;
  description?: string;
  completed: boolean;
  order: number;
  weight?: number;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  identityReinforcement?: string;
  milestoneIds: string[];
  active: boolean;
  targetHours?: number;
}

export interface WeeklySummary {
  week_start: string;
  total_minutes: number;
  deep_work_minutes: number;
  sessions_completed: number;
  sessions_started: number;
  avg_session_minutes: number;
  peak_hour: number | null;
  morning_minutes: number;
  afternoon_minutes: number;
  evening_minutes: number;
  tasks_touched: number;
  reflections_count: number;
  computed_at: string | null;
}

export interface GoalProgress {
  goalId: string;
  goalTitle: string;
  targetHours?: number;
  accumulatedMinutes: number;
  linkedTasks: Array<{
    taskId: string;
    title: string;
    minutes: number;
  }>;
}

export interface DailyIntentions {
  date: string;
  intentions: string[];
}

export interface ShutdownRitual {
  date: string;
  totalMinutes: number;
  deepWorkMinutes: number;
  tasksWorked: string[];  // Task IDs
  reflection: string | null;
  notes: string | null;
  tomorrowIntentions: string[] | null;
  locked: boolean;
  createdAt: string;
}

export interface DashboardAPI {
  // Task Preferences
  getTaskPreference: (taskId: string) => Promise<TaskPreference | null>;
  getAllTaskPreferences: () => Promise<TaskPreference[]>;
  setTaskPreference: (taskId: string, pref: Partial<TaskPreference>) => Promise<void>;

  // Milestones
  getMilestone: (id: string) => Promise<Milestone | null>;
  getMilestonesByParent: (parentType: string, parentId: string) => Promise<Milestone[]>;
  createMilestone: (milestone: Milestone) => Promise<void>;
  updateMilestone: (id: string, patch: Partial<Milestone>) => Promise<void>;
  deleteMilestone: (id: string) => Promise<void>;

  // Goals
  getGoal: (id: string) => Promise<Goal | null>;
  getAllGoals: () => Promise<Goal[]>;
  getActiveGoal: () => Promise<Goal | null>;
  createGoal: (goal: Goal) => Promise<void>;
  updateGoal: (id: string, patch: Partial<Goal>) => Promise<void>;
  setActiveGoal: (id: string) => Promise<void>;

  // Daily Intentions
  getDailyIntentions: (date: string) => Promise<DailyIntentions | null>;
  setDailyIntentions: (date: string, intentions: string[]) => Promise<void>;

  // Shutdown Rituals
  getShutdownRitual: (date: string) => Promise<ShutdownRitual | null>;
  saveShutdownRitual: (
    date: string,
    totalMinutes: number,
    deepWorkMinutes: number,
    tasksWorked: string[],
    reflection: string | null,
    notes: string | null,
    tomorrowIntentions: string[] | null
  ) => Promise<void>;
  unlockDay: (date: string) => Promise<void>;
  isDayLocked: (date: string) => Promise<boolean>;

  // Weekly Summaries
  getWeeklySummary: (weekStart: string) => Promise<WeeklySummary | null>;
  getWeeklySummariesInRange: (startDate: string, endDate: string) => Promise<WeeklySummary[]>;
  computeWeeklySummary: (weekStart: string) => Promise<void>;

  // Progress queries
  getTaskTotalMinutes: (taskId: string) => Promise<number>;
  getShutdownReflectionsInRange: (startDate: string, endDate: string) => Promise<Array<{ date: string; reflection: string; notes: string | null }>>;
  getSessionsByTimeOfDay: (startDate: string, endDate: string) => Promise<Array<{ hour: number; minutes: number }>>;

  // Task-Goal linking
  setTaskGoalId: (taskId: string, goalId: string | null) => Promise<void>;
}

export interface AIAPI {
  callOpenRouter: (apiKey: string, model: string, systemPrompt: string, userMessage: string) => Promise<{ success: boolean; text?: string; error?: string }>;
}

declare global {
  interface Window {
    timerAPI: TimerAPI;
    logAPI: LogAPI;
    dashboardAPI: DashboardAPI;
    aiAPI: AIAPI;
    listsAPI: ListsAPI;
    overlayAPI: OverlayAPI;
  }
}

// Lists types
export type ListItemColumn = 'backlog' | 'this_week' | 'today';

export interface TaskList {
  id: string;
  name: string;
  color: string;
  icon_path: string | null;
  task_id: string | null;
  order: number;
  archived: 0 | 1;
  billable: 0 | 1;
  created_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  title: string;
  task_id: string | null;
  column: ListItemColumn;
  order: number;
  completed: 0 | 1;
  archived: 0 | 1;
  completed_at: string | null;
  description: string | null;
  subtasks: string; // JSON: Subtask[]
  billable: 0 | 1;
  created_at: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface ListsAPI {
  getLists: () => Promise<TaskList[]>;
  getArchivedLists: () => Promise<TaskList[]>;
  createList: (list: Omit<TaskList, 'id' | 'created_at'>) => Promise<string>;
  updateList: (id: string, updates: Partial<TaskList>) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  archiveList: (id: string) => Promise<void>;
  unarchiveList: (id: string) => Promise<void>;
  getListItems: (listId: string) => Promise<ListItem[]>;
  getAllListItems: () => Promise<ListItem[]>;
  createListItem: (item: Omit<ListItem, 'id' | 'created_at'>) => Promise<string>;
  updateListItem: (id: string, updates: Partial<ListItem>) => Promise<void>;
  deleteListItem: (id: string) => Promise<void>;
  archiveOldCompleted: () => Promise<number>;
  getBillableForTask: (taskId: string | null) => Promise<boolean>;
}

// Component props
export interface TimerProps {
  // No props - uses store
}

export interface TimerControlsProps {
  status: TimerStatus;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onCancel: () => void;
}

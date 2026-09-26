import { contextBridge, ipcRenderer } from 'electron';
import type { PomodoroSession, TimerAPI, LogAPI, AdhocEntry, CalendarProposal, CalendarFeedResult, TaskCache, RankedTask, ApiTestResult, IssueData, TimeEntryPayload, OverlayActionType, IdleCommand } from '../src/types';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
const timerAPI: TimerAPI = {
  saveSession: async (session: Omit<PomodoroSession, 'id'>): Promise<string> => {
    const result = await ipcRenderer.invoke('save-session', session);
    if (result.success) {
      return result.id;
    }
    throw new Error(result.error || 'Failed to save session');
  },

  getSessions: async (date: string): Promise<PomodoroSession[]> => {
    const result = await ipcRenderer.invoke('get-sessions', date);
    if (result.success) {
      return result.sessions;
    }
    throw new Error(result.error || 'Failed to get sessions');
  },

  getLastSessionWithTask: async (date: string): Promise<PomodoroSession | null> => {
    const result = await ipcRenderer.invoke('get-last-session-with-task', date);
    if (result.success) {
      return result.session || null;
    }
    throw new Error(result.error || 'Failed to get last session');
  },

  getSettings: async (key: string): Promise<string | null> => {
    const result = await ipcRenderer.invoke('get-setting', key);
    if (result.success) {
      return result.value;
    }
    throw new Error(result.error || 'Failed to get setting');
  },

  saveSettings: async (key: string, value: string): Promise<void> => {
    const result = await ipcRenderer.invoke('save-setting', key, value);
    if (!result.success) {
      throw new Error(result.error || 'Failed to save setting');
    }
  },

  updateTrayTime: (time: string): void => {
    try {
      ipcRenderer.send('update-tray-time', time);
    } catch (error) {
      console.error('Failed to send tray update:', error);
    }
  },

  showNotification: (title: string, body: string): void => {
    ipcRenderer.send('show-notification', title, body);
  },

  testApiConnection: async (baseUrl: string, apiKey: string): Promise<ApiTestResult> => {
    const result = await ipcRenderer.invoke('test-api-connection', baseUrl, apiKey);
    if (result.success) {
      return result.data;
    }
    throw new Error(result.error || 'Failed to test API connection');
  },

  getIssue: async (baseUrl: string, apiKey: string, issueId: string): Promise<IssueData> => {
    const result = await ipcRenderer.invoke('get-issue', baseUrl, apiKey, issueId);
    if (result.success) {
      return result.data;
    }
    throw new Error(result.error || 'Failed to get issue');
  },

  postTimeEntry: async (baseUrl: string, apiKey: string, payload: TimeEntryPayload): Promise<number> => {
    const result = await ipcRenderer.invoke('post-time-entry', baseUrl, apiKey, payload);
    if (result.success) {
      return result.entryId;
    }
    throw new Error(result.error || 'Failed to post time entry');
  },

  fetchCalendarFeed: async (url: string, forceRefresh?: boolean): Promise<CalendarFeedResult> => {
    const result = await ipcRenderer.invoke('fetch-calendar-feed', url, forceRefresh);
    if (result.success) {
      return { data: result.data, fetchedAt: result.fetchedAt, fromCache: result.fromCache };
    }
    throw new Error(result.error || 'Failed to fetch calendar feed');
  },

  onCalendarFeedUpdated: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('calendar-feed-updated', handler);
    return () => ipcRenderer.removeListener('calendar-feed-updated', handler);
  },

  getDaysSinceLastLog: async (): Promise<number | null> => {
    const result = await ipcRenderer.invoke('get-days-since-last-log');
    if (result.success) {
      return result.days;
    }
    throw new Error(result.error || 'Failed to get days since last log');
  },

  openExternal: async (url: string): Promise<void> => {
    await ipcRenderer.invoke('open-external', url);
  },

  // Main process timer control
  startMainTimer: async (duration: number, timerType: 'focus' | 'break', nextBreakDuration?: 5 | 10, taskId?: string, kickoffRolloverSeconds?: number): Promise<{ raycastFocus: boolean }> => {
    const result = await ipcRenderer.invoke('start-main-timer', duration, timerType, nextBreakDuration, taskId, kickoffRolloverSeconds);
    if (!result.success) {
      throw new Error(result.error || 'Failed to start main timer');
    }
    return { raycastFocus: result.raycastFocus === true };
  },

  pauseMainTimer: async (): Promise<void> => {
    const result = await ipcRenderer.invoke('pause-main-timer');
    if (!result.success) {
      throw new Error(result.error || 'Failed to pause main timer');
    }
  },

  resumeMainTimer: async (): Promise<void> => {
    const result = await ipcRenderer.invoke('resume-main-timer');
    if (!result.success) {
      throw new Error(result.error || 'Failed to resume main timer');
    }
  },

  stopMainTimer: async (): Promise<void> => {
    const result = await ipcRenderer.invoke('stop-main-timer');
    if (!result.success) {
      throw new Error(result.error || 'Failed to stop main timer');
    }
  },

  getMainTimerState: async (): Promise<{
    status: 'idle' | 'focus' | 'break';
    remainingSeconds: number;
    startTime: Date | null;
  }> => {
    const result = await ipcRenderer.invoke('get-main-timer-state');
    if (result.success) {
      return result.state;
    }
    throw new Error(result.error || 'Failed to get main timer state');
  },

  extendMainTimer: async (additionalSeconds: number): Promise<void> => {
    const result = await ipcRenderer.invoke('extend-main-timer', additionalSeconds);
    if (!result.success) {
      throw new Error(result.error || 'Failed to extend main timer');
    }
  },

  // Listen for main timer events
  onTimerTick: (callback: (remainingSeconds: number) => void) => {
    ipcRenderer.on('timer-tick', (_event, remainingSeconds) => callback(remainingSeconds));
  },

  onTimerComplete: (callback: (timerType: 'focus' | 'break') => void) => {
    ipcRenderer.on('timer-complete', (_event, timerType) => callback(timerType));
  },

  onTimerExtended: (callback: (newRemaining: number) => void) => {
    ipcRenderer.on('timer-extended', (_event, newRemaining) => callback(newRemaining));
  },

  onUrlStartFocus: (callback: (data: { taskId?: string; intention?: string }) => void) => {
    ipcRenderer.on('url-start-focus', (_event, data) => callback(data));
  },

  onUrlTimerAction: (callback: (action: 'pause' | 'resume' | 'stop' | 'finish-early' | 'start-break' | 'skip-break', data?: any) => void) => {
    ipcRenderer.on('url-timer-action', (_event, action, data) => callback(action, data));
  },

  toggleTray: async (show: boolean): Promise<void> => {
    const result = await ipcRenderer.invoke('toggle-tray', show);
    if (!result.success) {
      throw new Error(result.error || 'Failed to toggle tray');
    }
  },

  // Session-end overlay
  showSessionOverlay: async (payload): Promise<{ shown: boolean }> => {
    const result = await ipcRenderer.invoke('overlay:show', payload);
    return { shown: !!result?.shown };
  },

  hideSessionOverlay: async (): Promise<void> => {
    await ipcRenderer.invoke('overlay:hide');
  },

  notifyBreakStarted: async (totalSeconds: number, isLong: boolean): Promise<void> => {
    await ipcRenderer.invoke('overlay:break-started', totalSeconds, isLong);
  },

  setOverlayEnabled: async (enabled: boolean): Promise<void> => {
    await ipcRenderer.invoke('overlay:set-enabled', enabled);
  },

  onOverlayAction: (callback: (type: OverlayActionType) => void) => {
    ipcRenderer.on('overlay-action', (_event, type) => callback(type));
  },

  onIdleCommand: (callback: (command: IdleCommand) => void) => {
    ipcRenderer.on('idle-command', (_event, command: IdleCommand) => callback(command));
  }
};

const logAPI: LogAPI = {
  getSessions: async (date: string): Promise<PomodoroSession[]> => {
    const result = await ipcRenderer.invoke('get-sessions', date);
    if (result.success) {
      return result.sessions;
    }
    throw new Error(result.error || 'Failed to get sessions');
  },

  getSessionsInRange: async (startDate: string, endDate: string): Promise<PomodoroSession[]> => {
    const result = await ipcRenderer.invoke('get-sessions-in-range', startDate, endDate);
    if (result.success) {
      return result.sessions;
    }
    throw new Error(result.error || 'Failed to get sessions in range');
  },

  updateSession: async (id: string, updates: Partial<PomodoroSession>): Promise<void> => {
    const result = await ipcRenderer.invoke('update-session', id, updates);
    if (!result.success) {
      throw new Error(result.error || 'Failed to update session');
    }
  },

  deleteSession: async (id: string): Promise<void> => {
    const result = await ipcRenderer.invoke('delete-session', id);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete session');
    }
  },

  getAdhocEntries: async (date: string): Promise<AdhocEntry[]> => {
    const result = await ipcRenderer.invoke('get-adhoc-entries', date);
    if (result.success) {
      return result.entries;
    }
    throw new Error(result.error || 'Failed to get adhoc entries');
  },

  getAdhocEntriesInRange: async (startDate: string, endDate: string): Promise<AdhocEntry[]> => {
    const result = await ipcRenderer.invoke('get-adhoc-entries-in-range', startDate, endDate);
    if (result.success) {
      return result.entries;
    }
    throw new Error(result.error || 'Failed to get adhoc entries in range');
  },

  addAdhocEntry: async (entry: Omit<AdhocEntry, 'id' | 'created_at'>): Promise<string> => {
    const result = await ipcRenderer.invoke('add-adhoc-entry', entry);
    if (result.success) {
      return result.id;
    }
    throw new Error(result.error || 'Failed to add adhoc entry');
  },

  updateAdhocEntry: async (id: string, updates: Partial<AdhocEntry>): Promise<void> => {
    const result = await ipcRenderer.invoke('update-adhoc-entry', id, updates);
    if (!result.success) {
      throw new Error(result.error || 'Failed to update adhoc entry');
    }
  },

  deleteAdhocEntry: async (id: string): Promise<void> => {
    const result = await ipcRenderer.invoke('delete-adhoc-entry', id);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete adhoc entry');
    }
  },

  getCalendarProposals: async (date: string, includeAll?: boolean): Promise<CalendarProposal[]> => {
    const result = await ipcRenderer.invoke('get-calendar-proposals', date, includeAll);
    if (result.success) {
      return result.proposals;
    }
    throw new Error(result.error || 'Failed to get calendar proposals');
  },

  getCachedTasks: async (): Promise<TaskCache[]> => {
    const result = await ipcRenderer.invoke('get-cached-tasks');
    if (result.success) {
      return result.tasks;
    }
    throw new Error(result.error || 'Failed to get cached tasks');
  },

  getCachedTask: async (taskId: string): Promise<TaskCache | null> => {
    const result = await ipcRenderer.invoke('get-cached-task', taskId);
    if (result.success) {
      return result.task;
    }
    throw new Error(result.error || 'Failed to get cached task');
  },

  cacheTask: async (taskId: string, title: string, projectId: number, projectName: string): Promise<void> => {
    const result = await ipcRenderer.invoke('cache-task', taskId, title, projectId, projectName);
    if (!result.success) {
      throw new Error(result.error || 'Failed to cache task');
    }
  },

  getRecentTasks: async (): Promise<TaskCache[]> => {
    const result = await ipcRenderer.invoke('get-recent-tasks');
    if (result.success) {
      return result.tasks;
    }
    throw new Error(result.error || 'Failed to get recent tasks');
  },

  getRankedRecentTasks: async (limit: number, today: string): Promise<RankedTask[]> => {
    const result = await ipcRenderer.invoke('get-ranked-recent-tasks', limit, today);
    if (result.success) {
      return result.tasks;
    }
    throw new Error(result.error || 'Failed to get ranked recent tasks');
  },

  getTaskMinutesByRange: async (from: string, to: string): Promise<Record<string, number>> => {
    const result = await ipcRenderer.invoke('get-task-minutes-by-range', from, to);
    if (result.success) {
      return result.minutes;
    }
    throw new Error(result.error || 'Failed to get task minutes');
  },

  searchTasks: async (query: string, limit?: number): Promise<TaskCache[]> => {
    const result = await ipcRenderer.invoke('search-cached-tasks', query, limit);
    if (result.success) {
      return result.tasks;
    }
    throw new Error(result.error || 'Failed to search tasks');
  },

  addCalendarProposal: async (proposal: Omit<CalendarProposal, 'id'>): Promise<string> => {
    const result = await ipcRenderer.invoke('add-calendar-proposal', proposal);
    if (result.success) {
      return result.id;
    }
    throw new Error(result.error || 'Failed to add calendar proposal');
  },

  updateCalendarProposal: async (id: string, updates: Partial<CalendarProposal>): Promise<void> => {
    const result = await ipcRenderer.invoke('update-calendar-proposal', id, updates);
    if (!result.success) {
      throw new Error(result.error || 'Failed to update calendar proposal');
    }
  },

  acceptCalendarProposal: async (id: string, taskId?: string): Promise<void> => {
    const result = await ipcRenderer.invoke('accept-calendar-proposal', id, taskId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to accept calendar proposal');
    }
  },

  dismissCalendarProposal: async (id: string): Promise<void> => {
    const result = await ipcRenderer.invoke('dismiss-calendar-proposal', id);
    if (!result.success) {
      throw new Error(result.error || 'Failed to dismiss calendar proposal');
    }
  },

  getTemplates: async (): Promise<any[]> => {
    const result = await ipcRenderer.invoke('get-templates');
    if (result.success) {
      return result.templates;
    }
    throw new Error(result.error || 'Failed to get templates');
  },

  addTemplate: async (template: any): Promise<string> => {
    const result = await ipcRenderer.invoke('add-template', template);
    if (result.success) {
      return result.id;
    }
    throw new Error(result.error || 'Failed to add template');
  },

  updateTemplate: async (id: string, template: any): Promise<void> => {
    const result = await ipcRenderer.invoke('update-template', id, template);
    if (!result.success) {
      throw new Error(result.error || 'Failed to update template');
    }
  },

  deleteTemplate: async (id: string): Promise<void> => {
    const result = await ipcRenderer.invoke('delete-template', id);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete template');
    }
  }
};

const dashboardAPI = {
  // Task Preferences
  getTaskPreference: (taskId: string) => ipcRenderer.invoke('get-task-preference', taskId),
  getAllTaskPreferences: () => ipcRenderer.invoke('get-all-task-preferences'),
  setTaskPreference: (taskId: string, pref: any) => ipcRenderer.invoke('set-task-preference', taskId, pref),

  // Milestones
  getMilestone: (id: string) => ipcRenderer.invoke('get-milestone', id),
  getMilestonesByParent: (parentType: string, parentId: string) =>
    ipcRenderer.invoke('get-milestones-by-parent', parentType, parentId),
  createMilestone: (milestone: any) => ipcRenderer.invoke('create-milestone', milestone),
  updateMilestone: (id: string, patch: any) => ipcRenderer.invoke('update-milestone', id, patch),
  deleteMilestone: (id: string) => ipcRenderer.invoke('delete-milestone', id),

  // Goals
  getGoal: (id: string) => ipcRenderer.invoke('get-goal', id),
  getAllGoals: () => ipcRenderer.invoke('get-all-goals'),
  getActiveGoal: () => ipcRenderer.invoke('get-active-goal'),
  createGoal: (goal: any) => ipcRenderer.invoke('create-goal', goal),
  updateGoal: (id: string, patch: any) => ipcRenderer.invoke('update-goal', id, patch),
  setActiveGoal: (id: string) => ipcRenderer.invoke('set-active-goal', id),

  // Daily Intentions
  getDailyIntentions: (date: string) => ipcRenderer.invoke('get-daily-intentions', date),
  setDailyIntentions: (date: string, intentions: string[]) =>
    ipcRenderer.invoke('set-daily-intentions', date, intentions),

  // Shutdown Rituals
  getShutdownRitual: (date: string) => ipcRenderer.invoke('get-shutdown-ritual', date),
  saveShutdownRitual: (
    date: string,
    totalMinutes: number,
    deepWorkMinutes: number,
    tasksWorked: string[],
    reflection: string | null,
    notes: string | null,
    tomorrowIntentions: string[] | null
  ) => ipcRenderer.invoke('save-shutdown-ritual', date, totalMinutes, deepWorkMinutes, tasksWorked, reflection, notes, tomorrowIntentions),
  unlockDay: (date: string) => ipcRenderer.invoke('unlock-day', date),
  isDayLocked: (date: string) => ipcRenderer.invoke('is-day-locked', date),

  // Weekly Summaries
  getWeeklySummary: async (weekStart: string) => {
    const result = await ipcRenderer.invoke('get-weekly-summary', weekStart);
    if (result.success) return result.summary;
    throw new Error(result.error);
  },
  getWeeklySummariesInRange: async (startDate: string, endDate: string) => {
    const result = await ipcRenderer.invoke('get-weekly-summaries-in-range', startDate, endDate);
    if (result.success) return result.summaries;
    throw new Error(result.error);
  },
  computeWeeklySummary: async (weekStart: string) => {
    const result = await ipcRenderer.invoke('compute-weekly-summary', weekStart);
    if (!result.success) throw new Error(result.error);
  },

  // Progress queries
  getTaskTotalMinutes: async (taskId: string) => {
    const result = await ipcRenderer.invoke('get-task-total-minutes', taskId);
    if (result.success) return result.minutes;
    throw new Error(result.error);
  },
  getShutdownReflectionsInRange: async (startDate: string, endDate: string) => {
    const result = await ipcRenderer.invoke('get-shutdown-reflections-in-range', startDate, endDate);
    if (result.success) return result.reflections;
    throw new Error(result.error);
  },
  getSessionsByTimeOfDay: async (startDate: string, endDate: string) => {
    const result = await ipcRenderer.invoke('get-sessions-by-time-of-day', startDate, endDate);
    if (result.success) return result.data;
    throw new Error(result.error);
  },

  // Task-Goal linking
  setTaskGoalId: async (taskId: string, goalId: string | null) => {
    const result = await ipcRenderer.invoke('set-task-goal-id', taskId, goalId);
    if (!result.success) throw new Error(result.error);
  }
};

const aiAPI = {
  callOpenRouter: async (apiKey: string, model: string, systemPrompt: string, userMessage: string) => {
    const result = await ipcRenderer.invoke('call-openrouter', apiKey, model, systemPrompt, userMessage);
    return result;
  }
};

const listsAPI = {
  getLists: async () => {
    const result = await ipcRenderer.invoke('get-lists');
    if (result.success) return result.lists;
    throw new Error(result.error || 'Failed to get lists');
  },
  createList: async (list: any) => {
    const result = await ipcRenderer.invoke('create-list', list);
    if (result.success) return result.id;
    throw new Error(result.error || 'Failed to create list');
  },
  updateList: async (id: string, updates: any) => {
    const result = await ipcRenderer.invoke('update-list', id, updates);
    if (!result.success) throw new Error(result.error || 'Failed to update list');
  },
  deleteList: async (id: string) => {
    const result = await ipcRenderer.invoke('delete-list', id);
    if (!result.success) throw new Error(result.error || 'Failed to delete list');
  },
  getListItems: async (listId: string) => {
    const result = await ipcRenderer.invoke('get-list-items', listId);
    if (result.success) return result.items;
    throw new Error(result.error || 'Failed to get list items');
  },
  getAllListItems: async () => {
    const result = await ipcRenderer.invoke('get-all-list-items');
    if (result.success) return result.items;
    throw new Error(result.error || 'Failed to get all list items');
  },
  createListItem: async (item: any) => {
    const result = await ipcRenderer.invoke('create-list-item', item);
    if (result.success) return result.id;
    throw new Error(result.error || 'Failed to create list item');
  },
  updateListItem: async (id: string, updates: any) => {
    const result = await ipcRenderer.invoke('update-list-item', id, updates);
    if (!result.success) throw new Error(result.error || 'Failed to update list item');
  },
  deleteListItem: async (id: string) => {
    const result = await ipcRenderer.invoke('delete-list-item', id);
    if (!result.success) throw new Error(result.error || 'Failed to delete list item');
  },
  archiveList: async (id: string) => {
    const result = await ipcRenderer.invoke('archive-list', id);
    if (!result.success) throw new Error(result.error || 'Failed to archive list');
  },
  unarchiveList: async (id: string) => {
    const result = await ipcRenderer.invoke('unarchive-list', id);
    if (!result.success) throw new Error(result.error || 'Failed to unarchive list');
  },
  getArchivedLists: async () => {
    const result = await ipcRenderer.invoke('get-archived-lists');
    if (result.success) return result.lists;
    throw new Error(result.error || 'Failed to get archived lists');
  },
  archiveOldCompleted: async () => {
    const result = await ipcRenderer.invoke('archive-old-completed');
    if (result.success) return result.count;
    throw new Error(result.error || 'Failed to archive old completed');
  },
  getBillableForTask: async (taskId: string | null) => {
    const result = await ipcRenderer.invoke('get-billable-for-task', taskId);
    if (result.success) return result.billable as boolean;
    throw new Error(result.error || 'Failed to resolve billable default');
  },
};

// Expose the APIs to the renderer process
contextBridge.exposeInMainWorld('timerAPI', timerAPI);
contextBridge.exposeInMainWorld('logAPI', logAPI);
contextBridge.exposeInMainWorld('dashboardAPI', dashboardAPI);
contextBridge.exposeInMainWorld('aiAPI', aiAPI);
contextBridge.exposeInMainWorld('listsAPI', listsAPI);

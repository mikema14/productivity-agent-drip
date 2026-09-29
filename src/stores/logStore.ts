import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PomodoroSession, AdhocEntry, CalendarProposal } from '../types';
import { easyProjectAPI } from '../services/api';
import { syncCalendarProposals } from '../services/calendar';
import { getCurrentDate } from '../utils/time';

// Combined entry type for the daily log view
export interface LogEntry {
  id: string;
  type: 'pomodoro' | 'adhoc' | 'calendar';
  source?: 'pomodoro' | 'manual' | 'calendar' | 'break';
  date: string;
  startTime: string | null;
  durationMinutes: number;
  taskId: string | null;
  title: string;
  comment: string | null;
  logged: boolean;
  markedToLog: boolean;
  isProposal?: boolean; // For calendar entries that need accept/dismiss
  billable?: boolean;
  projectId?: number;
  projectName?: string;
}

export interface LogResult {
  success: number;
  failed: number;
  errors: Array<{ entryId: string; error: string }>;
}

/**
 * A row `logSelected` can post: unlogged work (not a break), accepted (not a
 * calendar proposal) and with a task id. Rows without a task are blocked until
 * one is assigned (R22); their checkbox is disabled and they are never sent.
 */
export function isLoggable(e: LogEntry): boolean {
  return !e.logged && !e.isProposal && e.source !== 'break' && !!e.taskId;
}

// A single piece of time to record — used by both the "save locally" and the
// "post to Easy Project now" paths.
export interface TimeEntryInput {
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  title: string;
  taskId: string | null;
  comment: string | null;
  billable: boolean;
}

interface LogState {
  entries: LogEntry[];
  selectedDate: string;
  isLoading: boolean;
  viewMode: 'list' | 'timeline';

  // Actions
  setSelectedDate: (date: string) => void;
  setViewMode: (mode: 'list' | 'timeline') => void;
  loadDay: (date: string, skipSync?: boolean) => Promise<void>;
  addManualEntry: (entry: Partial<LogEntry>) => Promise<void>;
  updateEntry: (id: string, changes: Partial<LogEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  toggleLogMark: (id: string) => void;
  toggleSelectAll: () => Promise<void>;
  logSelected: () => Promise<LogResult>;
  logEntryNow: (entry: TimeEntryInput) => Promise<{ success: boolean; error?: string }>;
  moveEntries: (targetDate: string, entryIds?: string[]) => Promise<void>;
}

export const useLogStore = create<LogState>()(
  persist(
    (set, get) => ({
      entries: [],
      // Local calendar date: the UTC split opened yesterday between 00:00 and 02:00 CEST.
      selectedDate: getCurrentDate(),
      isLoading: false,
      viewMode: 'list',

      setSelectedDate: (date: string) => {
        set({ selectedDate: date });
        get().loadDay(date);
      },

      setViewMode: (mode: 'list' | 'timeline') => {
        set({ viewMode: mode });
      },

  loadDay: async (date: string, skipSync: boolean = false) => {
    set({ isLoading: true });

    try {
      // Sync calendar proposals from ICS feed (unless skipped for local-only operations)
      if (!skipSync) {
        await syncCalendarProposals(date);
      }

      // Load pomodoro sessions for the day
      const sessions = await window.logAPI.getSessions(date);

      // Load adhoc entries for the day
      const adhocEntries = await window.logAPI.getAdhocEntries(date);

      // Load calendar proposals for the day
      const calendarProposals = await window.logAPI.getCalendarProposals(date);

      // Convert to unified LogEntry format
      const pomodoroEntries: LogEntry[] = sessions.map(s => ({
        id: s.id,
        type: 'pomodoro' as const,
        source: (s.source as LogEntry['source']) || 'pomodoro',
        date: s.start_at.split('T')[0],
        startTime: s.start_at,
        durationMinutes: s.duration_minutes,
        taskId: s.task_id,
        title: s.source === 'break' ? 'Break' : (s.comment || 'Pomodoro session'),
        comment: s.comment,
        logged: s.logged === 1,
        markedToLog: s.source === 'break' ? false : (s.logged === 0),
        billable: s.billable !== 0, // Convert 1/0 to boolean
      }));

      const adhocLogEntries: LogEntry[] = adhocEntries.map(e => ({
        id: e.id,
        type: 'adhoc' as const,
        date: e.date,
        startTime: e.start_time || null,
        durationMinutes: e.duration_minutes,
        taskId: e.task_id,
        title: e.title,
        comment: e.comment,
        logged: e.logged === 1,
        markedToLog: e.marked_to_log === 1,
        billable: e.billable !== 0, // Convert 1/0 to boolean
      }));

      const calendarEntries: LogEntry[] = calendarProposals
        .filter(p => p.dismissed === 0) // Show all non-dismissed proposals
        .map(p => ({
          id: p.id,
          type: 'calendar' as const,
          date: p.date,
          startTime: p.start_at,
          durationMinutes: p.duration_minutes,
          taskId: p.task_id,
          title: p.title,
          comment: p.comment || null,
          logged: p.logged === 1,
          markedToLog: p.accepted === 1 && p.logged === 0, // Only mark accepted, unlogged ones for logging
          isProposal: p.accepted === 0, // True if not yet accepted
          billable: p.billable !== 0, // R7: rows from before the column read as billable
        }));

      // Combine and sort by start time
      const allEntries = [...pomodoroEntries, ...adhocLogEntries, ...calendarEntries]
        .sort((a, b) => {
          if (!a.startTime) return 1;
          if (!b.startTime) return -1;
          return a.startTime.localeCompare(b.startTime);
        });

      set({ entries: allEntries, isLoading: false });
    } catch (error) {
      console.error('Failed to load day entries:', error);
      set({ isLoading: false });
    }
  },

  addManualEntry: async (entry: Partial<LogEntry> & { startTime?: string | null }) => {
    const { selectedDate } = get();

    // Convert HH:MM start time to ISO datetime
    let startTimeValue: string | null = null;
    if (entry.startTime) {
      const [hours, minutes] = entry.startTime.split(':').map(Number);
      const startDate = new Date(selectedDate);
      startDate.setHours(hours, minutes, 0, 0);
      startTimeValue = startDate.toISOString();
    }

    const newEntry = {
      date: entry.date || selectedDate,
      duration_minutes: entry.durationMinutes || 30,
      title: entry.title || '',
      task_id: entry.taskId || null,
      comment: entry.comment || null,
      marked_to_log: 1 as 0 | 1,
      logged: 0 as 0 | 1,
      is_todo: 0 as 0 | 1,
      due_date: null,
      completed: 0 as 0 | 1,
      billable: (entry.billable !== undefined ? (entry.billable ? 1 : 0) : 1) as 0 | 1,
      start_time: startTimeValue,
    };

    try {
      await window.logAPI.addAdhocEntry(newEntry);
      // Reload the day to show the new entry (skip sync - local operation only)
      await get().loadDay(selectedDate, true);
    } catch (error) {
      console.error('Failed to add manual entry:', error);
      throw error;
    }
  },

  updateEntry: async (id: string, changes: Partial<LogEntry>) => {
    const { entries, selectedDate } = get();
    const entry = entries.find(e => e.id === id);

    if (!entry) return;

    try {
      if (entry.type === 'pomodoro') {
        // Only write fields actually present in `changes` so an edit can't clobber
        // an unrelated field (e.g. billable) to a default/undefined value.
        const dbUpdates: Partial<PomodoroSession> = {};
        if ('taskId' in changes) dbUpdates.task_id = changes.taskId ?? null;
        if ('comment' in changes) dbUpdates.comment = changes.comment || null;
        if ('durationMinutes' in changes) dbUpdates.duration_minutes = changes.durationMinutes;
        if ('billable' in changes) dbUpdates.billable = changes.billable ? 1 : 0;
        await window.logAPI.updateSession(id, dbUpdates);
      } else if (entry.type === 'adhoc') {
        const dbUpdates: Partial<AdhocEntry> = {};
        if ('taskId' in changes) dbUpdates.task_id = changes.taskId ?? null;
        if ('title' in changes) dbUpdates.title = changes.title;
        if ('comment' in changes) dbUpdates.comment = changes.comment || null;
        if ('durationMinutes' in changes) dbUpdates.duration_minutes = changes.durationMinutes;
        if ('markedToLog' in changes) dbUpdates.marked_to_log = changes.markedToLog ? 1 : 0;
        if ('billable' in changes) dbUpdates.billable = changes.billable ? 1 : 0;
        await window.logAPI.updateAdhocEntry(id, dbUpdates);
      } else if (entry.type === 'calendar') {
        // Same field gating as the other branches (R7): only what the edit sent.
        const dbUpdates: Partial<CalendarProposal> = {};
        if ('taskId' in changes) dbUpdates.task_id = changes.taskId || null;
        if ('title' in changes) dbUpdates.title = changes.title;
        if ('durationMinutes' in changes) dbUpdates.duration_minutes = changes.durationMinutes;
        if ('comment' in changes) dbUpdates.comment = changes.comment || null;
        if ('billable' in changes) dbUpdates.billable = changes.billable ? 1 : 0;
        await window.logAPI.updateCalendarProposal?.(id, dbUpdates);
      }

      // Reload the day to show updates (skip sync - local operation only)
      await get().loadDay(selectedDate, true);
    } catch (error) {
      console.error('Failed to update entry:', error);
      throw error;
    }
  },

  deleteEntry: async (id: string) => {
    const { entries, selectedDate } = get();
    const entry = entries.find(e => e.id === id);

    if (!entry) return;

    // Safety guard: prevent deleting logged entries
    if (entry.logged) {
      console.warn('Cannot delete logged entry:', id);
      window.timerAPI.showNotification(
        'Cannot Delete',
        'This entry has already been logged to Easy Project'
      );
      return;
    }

    try {
      // Delete based on entry type
      if (entry.type === 'pomodoro') {
        await window.logAPI.deleteSession?.(id);
      } else if (entry.type === 'adhoc') {
        await window.logAPI.deleteAdhocEntry(id);
      } else if (entry.type === 'calendar') {
        await window.logAPI.dismissCalendarProposal?.(id);
      }

      await get().loadDay(selectedDate, true);
    } catch (error) {
      console.error('Failed to delete entry:', error);
      throw error;
    }
  },

  toggleLogMark: async (id: string) => {
    const { entries, selectedDate } = get();
    const entry = entries.find(e => e.id === id);

    if (!entry || entry.logged || entry.isProposal) {
      return; // Can't toggle logged or proposal entries
    }

    const newMarkedState = !entry.markedToLog;

    try {
      // Update database for adhoc entries
      if (entry.type === 'adhoc') {
        await window.logAPI.updateAdhocEntry(id, {
          marked_to_log: newMarkedState ? 1 : 0
        });
      }

      // Update UI state immediately
      const updatedEntries = entries.map(e =>
        e.id === id ? { ...e, markedToLog: newMarkedState } : e
      );
      set({ entries: updatedEntries });

    } catch (error) {
      console.error('Failed to toggle log mark:', error);
      // Reload from DB to sync state
      await get().loadDay(selectedDate, true);
    }
  },

  toggleSelectAll: async () => {
    const { entries, selectedDate } = get();

    // Only loggable rows: never a break, a proposal, a logged row or one without a task (R22)
    const toggleableEntries = entries.filter(isLoggable);

    if (toggleableEntries.length === 0) {
      return;
    }

    // Determine new state: if any are unmarked, mark all; if all marked, unmark all
    const newState = toggleableEntries.some(e => !e.markedToLog);
    const ids = new Set(toggleableEntries.map(e => e.id));

    try {
      // Only adhoc rows persist the mark; the others keep it in UI state
      for (const entry of toggleableEntries) {
        if (entry.type === 'adhoc') {
          await window.logAPI.updateAdhocEntry(entry.id, {
            marked_to_log: newState ? 1 : 0
          });
        }
      }

      set({ entries: entries.map(e => (ids.has(e.id) ? { ...e, markedToLog: newState } : e)) });

    } catch (error) {
      console.error('Failed to toggle select all:', error);
      // Reload from DB to sync state
      await get().loadDay(selectedDate, true);
    }
  },

  logSelected: async () => {
    const { entries, selectedDate } = get();
    // Rows without a task are blocked, not sent (R22)
    const toLog = entries.filter(e => e.markedToLog && isLoggable(e));

    console.log('Logging these entries:', toLog);

    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ entryId: string; error: string }> = [];

    for (const entry of toLog) {
      try {
        if (!entry.taskId) continue; // unreachable: isLoggable requires it (narrows the type)
        if (entry.durationMinutes <= 0) {
          throw new Error('Duration must be greater than 0');
        }

        // Comment is optional - API accepts empty comments
        // If empty, use a default based on entry type
        const comment = entry.comment?.trim() || entry.title || 'Work session';

        // Fetch project info from task if not already cached
        let projectId = entry.projectId;
        let projectName = entry.projectName;

        if (!projectId) {
          console.log(`Fetching project info for task ${entry.taskId}`);
          const issueData = await easyProjectAPI.getIssue(entry.taskId);
          projectId = issueData.projectId;
          projectName = issueData.projectName;
        }

        // Convert minutes to hours (decimal)
        const hours = entry.durationMinutes / 60;

        console.log(`Posting time entry for task ${entry.taskId}: ${hours} hours`);

        // Post time entry to API
        const serverEntryId = await easyProjectAPI.postTimeEntry({
          issueId: entry.taskId,
          projectId: projectId,
          hours: hours,
          spentOn: entry.date,
          comments: comment,
          billable: entry.billable,
        });

        console.log(`Successfully posted entry, server ID: ${serverEntryId}`);

        // Mark entry as logged in database
        if (entry.type === 'pomodoro') {
          await window.logAPI.updateSession(entry.id, {
            logged: 1,
            log_sent_at: new Date().toISOString(),
            server_entry_id: serverEntryId,
          });
        } else if (entry.type === 'adhoc') {
          await window.logAPI.updateAdhocEntry(entry.id, {
            logged: 1,
          });
        } else if (entry.type === 'calendar') {
          await window.logAPI.updateCalendarProposal?.(entry.id, {
            logged: 1,
          });
        }

        successCount++;
      } catch (error) {
        console.error(`Failed to log entry ${entry.id}:`, error);
        failedCount++;
        errors.push({
          entryId: entry.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Reload the day to show updated logged status (skip sync - local operation only)
    await get().loadDay(selectedDate, true);

    return {
      success: successCount,
      failed: failedCount,
      errors,
    };
  },

  logEntryNow: async (entry: TimeEntryInput) => {
    // Always persist locally first, so a failed POST still leaves the time
    // recorded and marked-to-log for a retry from the Daily Log view.
    let localId: string;
    try {
      localId = await window.logAPI.addAdhocEntry({
        date: entry.date,
        duration_minutes: entry.durationMinutes,
        title: entry.title,
        task_id: entry.taskId,
        comment: entry.comment,
        marked_to_log: 1,
        logged: 0,
        is_todo: 0,
        due_date: null,
        completed: 0,
        billable: entry.billable ? 1 : 0,
        start_time: null,
      });
    } catch (error) {
      console.error('Failed to save entry before logging:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not save the entry',
      };
    }

    try {
      if (!entry.taskId) throw new Error('Task ID is required');
      if (entry.durationMinutes <= 0) throw new Error('Duration must be greater than 0');

      const { projectId } = await easyProjectAPI.getIssue(entry.taskId);

      // postTimeEntry rejects an empty comment, so fall back like logSelected does.
      const comment = entry.comment?.trim() || entry.title || 'Work session';

      await easyProjectAPI.postTimeEntry({
        issueId: entry.taskId,
        projectId,
        hours: entry.durationMinutes / 60,
        spentOn: entry.date,
        comments: comment,
        billable: entry.billable,
      });

      await window.logAPI.updateAdhocEntry(localId, { logged: 1 });

      return { success: true };
    } catch (error) {
      console.error('Failed to log entry to Easy Project:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      // Only refresh when the entry landed on the day currently on screen.
      if (entry.date === get().selectedDate) {
        await get().loadDay(entry.date, true);
      }
    }
  },

  moveEntries: async (targetDate: string, entryIds?: string[]) => {
    const { entries, selectedDate } = get();

    const toMove = entryIds
      ? entries.filter(e => entryIds.includes(e.id))
      : entries.filter(e => e.markedToLog && !e.logged && e.source !== 'break');

    for (const entry of toMove) {
      if (entry.type === 'adhoc') {
        await window.logAPI.updateAdhocEntry(entry.id, { date: targetDate });

      } else if (entry.type === 'pomodoro') {
        // Keep time-of-day, replace only the YYYY-MM-DD prefix
        const startAt = entry.startTime ?? '';
        const timePart = startAt.substring(10); // "T08:06:14.742Z"
        const newStartAt = `${targetDate}${timePart}`;
        await window.logAPI.updateSession(entry.id, { start_at: newStartAt });

      } else if (entry.type === 'calendar') {
        const updates: Record<string, unknown> = { date: targetDate };
        if (entry.startTime) {
          const timePart = entry.startTime.substring(10);
          const newStartAt = `${targetDate}${timePart}`;
          updates.start_at = newStartAt;
          const newStartMs = new Date(newStartAt).getTime();
          updates.end_at = new Date(newStartMs + entry.durationMinutes * 60 * 1000).toISOString();
        }
        await window.logAPI.updateCalendarProposal?.(entry.id, updates);
      }
    }

    await get().loadDay(selectedDate, true);
  },

  // Time calculation selectors
  getDailyFocusMinutes: (date: string) => {
    const { entries } = get();
    return entries
      .filter(e => e.date === date)
      .reduce((sum, e) => sum + e.durationMinutes, 0);
  },

  getWeeklyFocusSummary: (startDate: string) => {
    const { entries } = get();
    const start = new Date(startDate);
    const summary: { date: string; minutes: number }[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const minutes = entries
        .filter(e => e.date === dateStr)
        .reduce((sum, e) => sum + e.durationMinutes, 0);

      summary.push({ date: dateStr, minutes });
    }

    return summary.reverse(); // Oldest to newest
  },

  getTaskTotalMinutes: (taskId: string) => {
    const { entries } = get();
    return entries
      .filter(e => e.taskId === taskId)
      .reduce((sum, e) => sum + e.durationMinutes, 0);
  },

  getTaskProgress: (taskId: string) => {
    const { entries } = get();
    const taskEntries = entries.filter(e => e.taskId === taskId);

    if (taskEntries.length === 0) {
      return { totalMinutes: 0, sessionCount: 0, lastWorkedAt: null };
    }

    const totalMinutes = taskEntries.reduce((sum, e) => sum + e.durationMinutes, 0);
    const sessionCount = taskEntries.length;

    // Find most recent session
    const sorted = [...taskEntries].sort((a, b) =>
      new Date(b.startAt || b.date).getTime() - new Date(a.startAt || a.date).getTime()
    );
    const lastWorkedAt = sorted[0]?.startAt || sorted[0]?.date || null;

    return { totalMinutes, sessionCount, lastWorkedAt };
  },

  // Dashboard selectors - use these for dashboard components
  getWeeklyTrackedMinutes: (trackedTaskIds: string[]) => {
    const { entries } = get();
    const today = new Date();
    const summary: { date: string; minutes: number }[] = [];

    // Last 7 days (rolling)
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const minutes = entries
        .filter(e => e.date === dateStr && e.taskId && trackedTaskIds.includes(e.taskId))
        .reduce((sum, e) => sum + e.durationMinutes, 0);

      summary.push({ date: dateStr, minutes });
    }

    return summary;
  },

  getLast90DaysTrackedMinutes: (trackedTaskIds: string[]) => {
    const { entries } = get();
    const today = new Date();
    const summary: { date: string; minutes: number }[] = [];

    // Last 90 days
    for (let i = 89; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const minutes = entries
        .filter(e => e.date === dateStr && e.taskId && trackedTaskIds.includes(e.taskId))
        .reduce((sum, e) => sum + e.durationMinutes, 0);

      summary.push({ date: dateStr, minutes });
    }

    return summary;
  },

  getBestDayStats: (trackedTaskIds: string[]) => {
    const { entries } = get();
    const today = new Date();
    let bestDay = { date: '', minutes: 0 };

    // Check last 90 days
    for (let i = 0; i < 90; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const minutes = entries
        .filter(e => e.date === dateStr && e.taskId && trackedTaskIds.includes(e.taskId))
        .reduce((sum, e) => sum + e.durationMinutes, 0);

      if (minutes > bestDay.minutes) {
        bestDay = { date: dateStr, minutes };
      }
    }

    return bestDay;
  },

  getCurrentStreak: (trackedTaskIds: string[]) => {
    const { entries } = get();
    let streak = 0;
    const currentDate = new Date();

    // Count consecutive days with >= 25 minutes
    while (streak < 90) {
      const dateStr = currentDate.toISOString().split('T')[0];

      const minutes = entries
        .filter(e => e.date === dateStr && e.taskId && trackedTaskIds.includes(e.taskId))
        .reduce((sum, e) => sum + e.durationMinutes, 0);

      if (minutes < 25) break;

      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }

    return streak;
  },

  // ==================== DASHBOARD SELECTORS (ASYNC) ====================
  // These selectors query the database directly for historical data

  getDashboardWeeklyData: async (trackedTaskIds: string[]) => {
    if (!window.logAPI.getSessionsInRange || !window.logAPI.getAdhocEntriesInRange) {
      return []; // Fallback for older IPC
    }

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 6); // Last 7 days

    const start = startDate.toISOString().split('T')[0];
    const end = today.toISOString().split('T')[0];

    const [sessions, adhocEntries] = await Promise.all([
      window.logAPI.getSessionsInRange(start, end),
      window.logAPI.getAdhocEntriesInRange(start, end)
    ]);

    // Convert to LogEntry format and aggregate by day
    const summary: { date: string; minutes: number }[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - (6 - i)); // Start from 6 days ago
      const dateStr = date.toISOString().split('T')[0];

      const dayMinutes = [
        ...sessions.filter(s =>
          s.start_at.startsWith(dateStr) &&
          s.task_id &&
          trackedTaskIds.includes(s.task_id)
        ).map(s => s.duration_minutes),
        ...adhocEntries.filter(e =>
          e.date === dateStr &&
          e.task_id &&
          trackedTaskIds.includes(e.task_id)
        ).map(e => e.duration_minutes)
      ].reduce((sum, minutes) => sum + minutes, 0);

      summary.push({ date: dateStr, minutes: dayMinutes });
    }

    return summary;
  },

  getDashboard90DaysData: async (trackedTaskIds: string[]) => {
    if (!window.logAPI.getSessionsInRange || !window.logAPI.getAdhocEntriesInRange) {
      return [];
    }

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 89); // Last 90 days

    const start = startDate.toISOString().split('T')[0];
    const end = today.toISOString().split('T')[0];

    const [sessions, adhocEntries] = await Promise.all([
      window.logAPI.getSessionsInRange(start, end),
      window.logAPI.getAdhocEntriesInRange(start, end)
    ]);

    // Aggregate by day
    const summary: { date: string; minutes: number }[] = [];

    for (let i = 89; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayMinutes = [
        ...sessions.filter(s =>
          s.start_at.startsWith(dateStr) &&
          s.task_id &&
          trackedTaskIds.includes(s.task_id)
        ).map(s => s.duration_minutes),
        ...adhocEntries.filter(e =>
          e.date === dateStr &&
          e.task_id &&
          trackedTaskIds.includes(e.task_id)
        ).map(e => e.duration_minutes)
      ].reduce((sum, minutes) => sum + minutes, 0);

      summary.push({ date: dateStr, minutes: dayMinutes });
    }

    return summary;
  },

  // Deep Work vs Total Work Selectors
  // Total work = all logged entries (including untracked tasks)
  // Deep work = only tracked tasks (existing getDashboardWeeklyData/getDashboard90DaysData)

  getDashboardWeeklyAllData: async () => {
    if (!window.logAPI.getSessionsInRange || !window.logAPI.getAdhocEntriesInRange) {
      return [];
    }

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 6); // Last 7 days

    const start = startDate.toISOString().split('T')[0];
    const end = today.toISOString().split('T')[0];

    const [sessions, adhocEntries] = await Promise.all([
      window.logAPI.getSessionsInRange(start, end),
      window.logAPI.getAdhocEntriesInRange(start, end)
    ]);

    // Aggregate ALL tasks by day (no filtering)
    const summary: { date: string; minutes: number }[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - (6 - i));
      const dateStr = date.toISOString().split('T')[0];

      const dayMinutes = [
        ...sessions.filter(s => s.start_at.startsWith(dateStr)).map(s => s.duration_minutes),
        ...adhocEntries.filter(e => e.date === dateStr).map(e => e.duration_minutes)
      ].reduce((sum, minutes) => sum + minutes, 0);

      summary.push({ date: dateStr, minutes: dayMinutes });
    }

    return summary;
  },

  getDashboard90DaysAllData: async () => {
    if (!window.logAPI.getSessionsInRange || !window.logAPI.getAdhocEntriesInRange) {
      return [];
    }

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 89); // Last 90 days

    const start = startDate.toISOString().split('T')[0];
    const end = today.toISOString().split('T')[0];

    const [sessions, adhocEntries] = await Promise.all([
      window.logAPI.getSessionsInRange(start, end),
      window.logAPI.getAdhocEntriesInRange(start, end)
    ]);

    // Aggregate ALL tasks by day (no filtering)
    const summary: { date: string; minutes: number }[] = [];

    for (let i = 89; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayMinutes = [
        ...sessions.filter(s => s.start_at.startsWith(dateStr)).map(s => s.duration_minutes),
        ...adhocEntries.filter(e => e.date === dateStr).map(e => e.duration_minutes)
      ].reduce((sum, minutes) => sum + minutes, 0);

      summary.push({ date: dateStr, minutes: dayMinutes });
    }

    return summary;
  },

  getDashboardHighlights: async (trackedTaskIds: string[]) => {
    const data90Days = await get().getDashboard90DaysData(trackedTaskIds);

    // Best day
    const bestDay = data90Days.reduce((best, day) =>
      day.minutes > best.minutes ? day : best,
      { date: '', minutes: 0 }
    );

    // Current streak
    let streak = 0;
    for (let i = data90Days.length - 1; i >= 0; i--) {
      if (data90Days[i].minutes >= 25) {
        streak++;
      } else {
        break;
      }
    }

    // Weekly trend
    const thisWeek = data90Days.slice(-7).reduce((sum, d) => sum + d.minutes, 0);
    const lastWeek = data90Days.slice(-14, -7).reduce((sum, d) => sum + d.minutes, 0);
    const trend = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0;

    return {
      bestDay,
      currentStreak: streak,
      weeklyTrend: trend,
      thisWeekMinutes: thisWeek
    };
  },

  getMonthlyStats: async (year: number, month: number) => {
    if (!window.logAPI) return null;

    // Calculate date range for the month (1-indexed month)
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of the month
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    try {
      // Fetch data for the month
      const [sessions, adhocEntries] = await Promise.all([
        window.logAPI.getSessionsInRange?.(startDateStr, endDateStr) || Promise.resolve([]),
        window.logAPI.getAdhocEntriesInRange?.(startDateStr, endDateStr) || Promise.resolve([])
      ]);

      // Total minutes = all work (sessions excl. breaks + adhoc)
      const totalMinutes = [
        ...sessions.filter(s => s.source !== 'break').map(s => s.duration_minutes),
        ...adhocEntries.map(e => e.duration_minutes)
      ].reduce((sum, minutes) => sum + minutes, 0);

      // Deep work = pomodoro focus sessions only (source='pomodoro')
      const deepWorkMinutes = sessions
        .filter(s => s.source === 'pomodoro')
        .reduce((sum, s) => sum + s.duration_minutes, 0);

      // Daily breakdown
      const daysInMonth = endDate.getDate();
      const dailyMinutes: { date: string; minutes: number; deepMinutes: number }[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, month - 1, day);
        const dateStr = dateObj.toISOString().split('T')[0];
        const dayTotal = [
          ...sessions.filter(s => s.start_at.startsWith(dateStr) && s.source !== 'break').map(s => s.duration_minutes),
          ...adhocEntries.filter(e => e.date === dateStr).map(e => e.duration_minutes)
        ].reduce((sum, minutes) => sum + minutes, 0);
        const dayDeep = sessions
          .filter(s => s.start_at.startsWith(dateStr) && s.source === 'pomodoro')
          .reduce((sum, s) => sum + s.duration_minutes, 0);
        dailyMinutes.push({ date: dateStr, minutes: dayTotal, deepMinutes: dayDeep });
      }

      // Fetch reflections using range query (replaces N+1 loop)
      let reflections: Array<{ date: string; reflection: string; notes: string | null }> = [];
      if (window.dashboardAPI?.getShutdownReflectionsInRange) {
        reflections = await window.dashboardAPI.getShutdownReflectionsInRange(startDateStr, endDateStr);
      }

      return {
        year,
        month,
        totalMinutes,
        deepWorkMinutes,
        daysWorked: dailyMinutes.filter(d => d.minutes > 0).length,
        dailyMinutes,
        reflections
      };
    } catch (error) {
      console.error('Failed to get monthly stats:', error);
      return null;
    }
  }
}),
    {
      name: 'log-storage',
      // R1: `selectedDate` is session state only, so Review always opens on today.
      partialize: (state) => ({
        viewMode: state.viewMode,
      }),
      // Storage written before R1 still holds a selectedDate; never rehydrate it.
      merge: (persisted, current) => {
        const { selectedDate: _stale, ...rest } = (persisted ?? {}) as Partial<LogState>;
        return { ...current, ...rest };
      },
    }
  )
);

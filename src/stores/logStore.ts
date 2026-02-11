import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PomodoroSession, AdhocEntry, CalendarProposal } from '../types';
import { easyProjectAPI } from '../services/api';
import { syncCalendarProposals } from '../services/calendar';

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
}

export const useLogStore = create<LogState>()(
  persist(
    (set, get) => ({
      entries: [],
      selectedDate: new Date().toISOString().split('T')[0],
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
          logged: false,
          markedToLog: p.accepted === 1, // Only mark accepted ones for logging
          isProposal: p.accepted === 0, // True if not yet accepted
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
        await window.logAPI.updateSession(id, {
          task_id: changes.taskId,
          comment: changes.comment || null,
          duration_minutes: changes.durationMinutes,
          billable: changes.billable !== undefined ? (changes.billable ? 1 : 0) : undefined,
        });
      } else if (entry.type === 'adhoc') {
        await window.logAPI.updateAdhocEntry(id, {
          task_id: changes.taskId,
          title: changes.title,
          comment: changes.comment || null,
          duration_minutes: changes.durationMinutes,
          marked_to_log: changes.markedToLog ? 1 : 0,
          billable: changes.billable !== undefined ? (changes.billable ? 1 : 0) : undefined,
        });
      } else if (entry.type === 'calendar') {
        await window.logAPI.updateCalendarProposal?.(id, {
          task_id: changes.taskId || null,
          title: changes.title,
          duration_minutes: changes.durationMinutes,
          comment: changes.comment || null,
        });
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

    // Get all toggleable entries (not logged, not proposals)
    const toggleableEntries = entries.filter(e => !e.logged && !e.isProposal);

    if (toggleableEntries.length === 0) {
      return;
    }

    // Determine new state: if any are unmarked, mark all; if all marked, unmark all
    const anyUnmarked = toggleableEntries.some(e => !e.markedToLog);
    const newState = anyUnmarked;

    try {
      // Update database for all entry types
      for (const entry of toggleableEntries) {
        if (entry.type === 'adhoc') {
          await window.logAPI.updateAdhocEntry(entry.id, {
            marked_to_log: newState ? 1 : 0
          });
        } else if (entry.type === 'pomodoro') {
          // Pomodoro sessions don't have marked_to_log field, they use markedToLog in UI only
          // But we should still update the UI state for them
        }
      }

      // Update UI state for all toggleable entries
      const updatedEntries = entries.map(e => {
        if (e.logged || e.isProposal) {
          return e; // Don't change logged or proposal entries
        }
        return { ...e, markedToLog: newState };
      });
      set({ entries: updatedEntries });

    } catch (error) {
      console.error('Failed to toggle select all:', error);
      // Reload from DB to sync state
      await get().loadDay(selectedDate, true);
    }
  },

  logSelected: async () => {
    const { entries, selectedDate } = get();
    const toLog = entries.filter(e => e.markedToLog && !e.logged && e.source !== 'break');

    console.log('Logging these entries:', toLog);

    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ entryId: string; error: string }> = [];

    for (const entry of toLog) {
      try {
        // Validate required fields
        if (!entry.taskId) {
          throw new Error('Task ID is required');
        }
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

  getMonthlyStats: async (year: number, month: number, trackedTaskIds: string[]) => {
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

      // Calculate total minutes
      const totalMinutes = [
        ...sessions.map(s => s.duration_minutes),
        ...adhocEntries.map(e => e.duration_minutes)
      ].reduce((sum, minutes) => sum + minutes, 0);

      // Calculate deep work minutes
      // If no tasks marked as tracked → ALL work = deep work (per spec)
      const deepWorkMinutes = trackedTaskIds.length > 0
        ? [
            ...sessions.filter(s => s.task_id && trackedTaskIds.includes(s.task_id)).map(s => s.duration_minutes),
            ...adhocEntries.filter(e => e.task_id && trackedTaskIds.includes(e.task_id)).map(e => e.duration_minutes)
          ].reduce((sum, minutes) => sum + minutes, 0)
        : totalMinutes; // All work counts as deep work

      // Calculate best day streak
      const daysInMonth = endDate.getDate();
      const dailyMinutes: { date: string; minutes: number }[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, month - 1, day);
        const dateStr = dateObj.toISOString().split('T')[0];
        const dayMinutes = [
          ...sessions.filter(s => s.start_at.startsWith(dateStr)).map(s => s.duration_minutes),
          ...adhocEntries.filter(e => e.date === dateStr).map(e => e.duration_minutes)
        ].reduce((sum, minutes) => sum + minutes, 0);
        dailyMinutes.push({ date: dateStr, minutes: dayMinutes });
      }

      // Find longest streak of days with >0 work
      let maxStreak = 0;
      let currentStreak = 0;
      for (const day of dailyMinutes) {
        if (day.minutes > 0) {
          currentStreak++;
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }

      // Fetch reflections from shutdown rituals (if available)
      const reflections: Array<{ date: string; reflection: string }> = [];
      if (window.dashboardAPI?.getShutdownRitual) {
        for (const day of dailyMinutes) {
          const ritual = await window.dashboardAPI.getShutdownRitual(day.date);
          if (ritual?.reflection) {
            reflections.push({ date: day.date, reflection: ritual.reflection });
          }
        }
      }

      return {
        year,
        month,
        totalMinutes,
        deepWorkMinutes,
        bestDayStreak: maxStreak,
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
      partialize: (state) => ({
        viewMode: state.viewMode,
        selectedDate: state.selectedDate,
      }),
    }
  )
);

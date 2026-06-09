import type { LogEntry, PomodoroSession } from '../types';

export interface MergedEntry extends LogEntry {
  isMerged: boolean;
  sourceCount: number;
  sourceEntries: LogEntry[];
}

export interface GroupedSession extends PomodoroSession {
  isMerged: boolean;
  sourceCount: number;
  sourceEntries: PomodoroSession[];
}

export function mergeEntriesByTaskId(entries: LogEntry[]): MergedEntry[] {
  // Group entries by task ID
  const grouped = new Map<string, LogEntry[]>();

  entries.forEach(entry => {
    // Use task ID as key, or unique key for unassigned entries
    const key = entry.taskId || `unassigned-${entry.id}`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(entry);
  });

  // Convert groups to merged entries
  return Array.from(grouped.entries()).map(([taskId, group]) => {
    // Don't merge unassigned entries
    if (taskId.startsWith('unassigned-')) {
      return {
        ...group[0],
        isMerged: false,
        sourceCount: 1,
        sourceEntries: [group[0]]
      };
    }

    // Don't merge if only one entry
    if (group.length === 1) {
      return {
        ...group[0],
        isMerged: false,
        sourceCount: 1,
        sourceEntries: [group[0]]
      };
    }

    // Merge multiple entries with same task ID
    const totalMinutes = group.reduce((sum, e) => sum + e.durationMinutes, 0);
    const comments = group
      .map(e => e.comment)
      .filter(Boolean)
      .join('; ');

    // Take first entry as base, override with merged data
    return {
      ...group[0],
      id: `merged-${taskId}`, // Virtual ID
      durationMinutes: totalMinutes,
      comment: comments || group[0].comment,
      billable: group.every(e => e.billable), // Billable only if every source is billable
      logged: group.every(e => e.logged), // Logged only if ALL sources are logged
      markedToLog: group.some(e => e.markedToLog), // Marked if any source is marked
      isMerged: true,
      sourceCount: group.length,
      sourceEntries: group
    };
  });
}

// Group pomodoro sessions by task ID (for Timer view)
export function groupSessionsByTaskId(sessions: PomodoroSession[]): GroupedSession[] {
  // Group sessions by task ID
  const grouped = new Map<string, PomodoroSession[]>();

  sessions.forEach(session => {
    // Use task ID as key, or unique key for unassigned sessions
    const key = session.task_id || `unassigned-${session.id}`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(session);
  });

  // Convert groups to grouped sessions
  return Array.from(grouped.entries()).map(([taskId, group]) => {
    // Don't merge unassigned sessions
    if (taskId.startsWith('unassigned-')) {
      return {
        ...group[0],
        isMerged: false,
        sourceCount: 1,
        sourceEntries: [group[0]]
      };
    }

    // Don't merge if only one session
    if (group.length === 1) {
      return {
        ...group[0],
        isMerged: false,
        sourceCount: 1,
        sourceEntries: [group[0]]
      };
    }

    // Merge multiple sessions with same task ID
    const totalMinutes = group.reduce((sum, s) => sum + s.duration_minutes, 0);
    const comments = group
      .map(s => s.comment)
      .filter(Boolean)
      .join('; ');

    // Take first session as base, override with merged data
    return {
      ...group[0],
      id: `merged-${taskId}`, // Virtual ID
      duration_minutes: totalMinutes,
      comment: comments || group[0].comment,
      billable: group.every(s => s.billable) ? 1 : 0, // Billable only if every source is billable
      logged: group.every(s => s.logged) ? 1 : 0, // Logged only if ALL sources are logged
      isMerged: true,
      sourceCount: group.length,
      sourceEntries: group
    };
  });
}

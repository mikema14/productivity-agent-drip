import type { LogEntry } from '../stores/logStore';
import type { MergedEntry } from '../utils/mergeEntries';

export type EntryKind = 'pomodoro' | 'adhoc' | 'calendar' | 'proposal' | 'break' | 'logged';

export const FIXTURE_DATE = '2026-09-25';

/**
 * Builds a `LogEntry` of one of the shapes `loadDay` produces. `logged` is a
 * pomodoro row already sent to Easy Project.
 */
export function makeEntry(kind: EntryKind, overrides: Partial<LogEntry> = {}): LogEntry {
  const base: LogEntry = {
    id: `${kind}-1`,
    type: 'pomodoro',
    source: 'pomodoro',
    date: FIXTURE_DATE,
    startTime: `${FIXTURE_DATE}T09:00:00.000`,
    durationMinutes: 25,
    taskId: '643749',
    title: 'Focus session',
    comment: 'Focus session',
    logged: false,
    markedToLog: true,
    billable: true,
  };
  switch (kind) {
    case 'adhoc':
      Object.assign(base, { type: 'adhoc', source: undefined, startTime: null, title: 'Manual work', comment: null, durationMinutes: 30 });
      break;
    case 'calendar':
      Object.assign(base, { type: 'calendar', source: undefined, title: 'Daily standup', comment: null, isProposal: false, durationMinutes: 30, startTime: `${FIXTURE_DATE}T09:40:00.000` });
      break;
    case 'proposal':
      Object.assign(base, { type: 'calendar', source: undefined, title: 'KKS upsell call', comment: null, isProposal: true, markedToLog: false, taskId: null, durationMinutes: 60, startTime: `${FIXTURE_DATE}T13:00:00.000` });
      break;
    case 'break':
      Object.assign(base, { source: 'break', title: 'Break', comment: null, taskId: null, markedToLog: false, durationMinutes: 5, startTime: `${FIXTURE_DATE}T09:25:00.000` });
      break;
    case 'logged':
      Object.assign(base, { logged: true, markedToLog: false, title: 'Proposal draft', comment: 'Proposal draft', startTime: `${FIXTURE_DATE}T14:10:00.000` });
      break;
    default:
      break;
  }
  return { ...base, ...overrides };
}

/** Wraps a LogEntry as the flat (unmerged) `MergedEntry` DailyLog hands to rows. */
export function asMerged(entry: LogEntry, sources: LogEntry[] = [entry]): MergedEntry {
  return { ...entry, isMerged: sources.length > 1, sourceCount: sources.length, sourceEntries: sources };
}

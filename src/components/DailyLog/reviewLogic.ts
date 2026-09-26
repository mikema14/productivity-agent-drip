import type { CalendarProposal } from '../../types';
import type { LogEntry } from '../../stores/logStore';
import type { MergedEntry } from '../../utils/mergeEntries';
import { formatMinutes } from '../../utils/time';
import { DAY_TARGET_MINUTES } from '../Timer/TimerDayTimeline';

/**
 * Pure logic behind the Review screen (PHASE3_PLAN.md §3.3). No React, no
 * store: the header stats, the footer summary, the date arithmetic and every
 * per-row display rule live here so they can be tested without JSX.
 */

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `YYYY-MM-DD` → local Date at midnight (never the UTC shift of `new Date(str)`). */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Local Date → `YYYY-MM-DD`. */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today as `YYYY-MM-DD` in local time. */
export function todayString(now: Date = new Date()): string {
  return toDateString(now);
}

/** `YYYY-MM-DD` ± days, in local calendar arithmetic (DST-safe). */
export function shiftDate(date: string, days: number): string {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

/** `Fri 25 Sep` (R20). */
export function shortDate(date: string): string {
  const d = parseLocalDate(date);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

export interface DateLabel {
  text: string;
  isToday: boolean;
}

/** Header date label: `Fri 25 Sep`, flagged when it is today (the UI appends `· Today`). */
export function dateLabel(date: string, today: string): DateLabel {
  return { text: shortDate(date), isToday: date === today };
}

/** Next Mon–Fri day after `date` (R4): Fri → Mon, Sat → Mon, Sun → Mon, Mon → Tue. */
export function nextWorkday(date: string): string {
  let next = shiftDate(date, 1);
  while ([0, 6].includes(parseLocalDate(next).getDay())) next = shiftDate(next, 1);
  return next;
}

/** `Mon 28 Sep` for the aside heading. */
export function tomorrowLabel(date: string): string {
  return shortDate(nextWorkday(date));
}

export interface DayStats {
  trackedMinutes: number;
  billableMinutes: number;
  breakMinutes: number;
  markedCount: number;
  loggedCount: number;
  toggleableCount: number;
  allSelected: boolean;
}

/** Header stats over the rows on screen (merged or flat), as DailyLog computed them, plus billable. */
export function dayStats(entries: MergedEntry[]): DayStats {
  const work = entries.filter(e => e.source !== 'break');
  const breaks = entries.filter(e => e.source === 'break');
  const trackedMinutes = work.reduce((sum, e) => sum + e.durationMinutes, 0);
  const billableMinutes = work.filter(e => e.billable !== false).reduce((sum, e) => sum + e.durationMinutes, 0);
  const breakMinutes = breaks.reduce((sum, e) => sum + e.durationMinutes, 0);
  const markedCount = entries.filter(e => e.markedToLog && !e.logged).length;
  const loggedCount = entries.filter(e => e.logged).length;
  const toggleableCount = entries.filter(e => !e.logged && !e.isProposal && e.source !== 'break').length;
  return {
    trackedMinutes,
    billableMinutes,
    breakMinutes,
    markedCount,
    loggedCount,
    toggleableCount,
    allSelected: toggleableCount > 0 && markedCount === toggleableCount,
  };
}

export interface SelectionSummary {
  selectedCount: number;
  selectedMinutes: number;
  needsTaskCount: number;
}

/** Footer summary: what `logSelected` would send (`markedToLog && !logged && !break`), and how many lack an id (R9). */
export function selectionSummary(entries: MergedEntry[]): SelectionSummary {
  const selected = entries.filter(e => e.markedToLog && !e.logged && e.source !== 'break');
  return {
    selectedCount: selected.length,
    selectedMinutes: selected.reduce((sum, e) => sum + e.durationMinutes, 0),
    needsTaskCount: selected.filter(e => !e.taskId).length,
  };
}

export interface TomorrowCalendar {
  meetings: number;
  meetingMinutes: number;
  freeMinutes: number;
}

/** `N meetings · Xh Ym` and `free = max(0, 6h − meetings)` over non-dismissed proposals (R4). */
export function tomorrowCalendar(proposals: CalendarProposal[]): TomorrowCalendar {
  const live = proposals.filter(p => p.dismissed === 0);
  const meetingMinutes = live.reduce((sum, p) => sum + p.duration_minutes, 0);
  return {
    meetings: live.length,
    meetingMinutes,
    freeMinutes: Math.max(0, DAY_TARGET_MINUTES - meetingMinutes),
  };
}

export type RowKind = 'break' | 'proposal' | 'logged' | 'open';

export interface RowModel {
  kind: RowKind;
  /** Tailwind background class of the 6px type dot: amber work, blue calendar, emerald break. */
  dotClass: string;
  timeText: string;
  durText: string;
  primaryText: string;
  /** Comment when it differs from the title (R5); null otherwise. */
  secondaryText: string | null;
  canToggle: boolean;
  canEdit: boolean;
  canMove: boolean;
  canDelete: boolean;
  canAcceptDismiss: boolean;
  billableInteractive: boolean;
  /** Effective billable flag (undefined reads as billable, as logging does). */
  billable: boolean;
}

/** `HH:mm` local, or `--:--` for unscheduled rows (as TimelineItem did). */
export function formatTimeOfDay(iso: string | null): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Every display rule of the old EntryRow (`:151-284`) and the mockup row, in one place. */
export function rowModel(entry: MergedEntry | LogEntry): RowModel {
  const isBreak = entry.source === 'break';
  const kind: RowKind = isBreak ? 'break' : entry.isProposal ? 'proposal' : entry.logged ? 'logged' : 'open';
  const dotClass = isBreak ? 'bg-break' : entry.type === 'calendar' ? 'bg-blue-400' : 'bg-focus';
  const comment = entry.comment?.trim() || '';
  const primaryText = isBreak ? 'Break' : entry.title;
  const secondaryText = !isBreak && comment && comment !== entry.title ? comment : null;
  return {
    kind,
    dotClass,
    timeText: formatTimeOfDay(entry.startTime),
    durText: formatMinutes(entry.durationMinutes),
    primaryText,
    secondaryText,
    canToggle: kind === 'open',
    canEdit: kind === 'open',
    canMove: kind === 'open',
    canDelete: kind === 'open',
    canAcceptDismiss: kind === 'proposal',
    billableInteractive: kind === 'open' || kind === 'proposal',
    billable: entry.billable !== false,
  };
}

/** Easy Project time-entries list for the day, filtered to the hard-coded user (moved verbatim from DailyLog). */
export function buildEPLink(date: string): string {
  const params = new URLSearchParams({
    only_me: 'true',
    set_filter: '1',
    spent_on: `${date}|${date}`,
    user_id: '28668',
  });
  return `https://es.easyproject.com/easy_time_entries?${params}`;
}

export type ErrorKind = '401' | '404' | '422' | 'server' | 'other';

export interface ErrorHint {
  kind: ErrorKind;
  /** `settings` when the fix lives in Settings (bad or missing API key). */
  action?: 'settings';
}

/** Classifies the strings `electron/main.ts` and `api.ts` produce (R18). */
export function errorHint(message: string): ErrorHint {
  const m = message.toLowerCase();
  if (m.includes('(401)') || m.includes('invalid api key') || m.includes('api not configured')) return { kind: '401', action: 'settings' };
  if (m.includes('(404)') || m.includes('not found')) return { kind: '404' };
  if (m.includes('validation error') || m.includes('(422)')) return { kind: '422' };
  if (/api error: 5\d\d/.test(m)) return { kind: 'server' };
  return { kind: 'other' };
}

/** `2h 05m` style used by the header and footer (hours + zero-padded minutes). */
export function formatMinutesPadded(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

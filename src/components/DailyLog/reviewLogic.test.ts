import { describe, it, expect } from 'vitest';
import {
  buildEPLink, dateLabel, dayStats, errorHint, formatMinutesPadded, formatTimeOfDay, nextWorkday,
  rowModel, selectionSummary, shiftDate, tomorrowCalendar, tomorrowLabel,
} from './reviewLogic';
import { DAY_TARGET_MINUTES } from '../Timer/TimerDayTimeline';
import { makeEntry, asMerged, FIXTURE_DATE } from '../../test/logFixtures';
import type { CalendarProposal } from '../../types';

const rows = (...list: ReturnType<typeof makeEntry>[]) => list.map(e => asMerged(e));

describe('reviewLogic.dayStats', () => {
  it('excludes breaks from tracked, sums billable over rows not marked false, counts marks and logged', () => {
    const stats = dayStats(rows(
      makeEntry('pomodoro', { id: 'a', durationMinutes: 25 }),
      makeEntry('adhoc', { id: 'b', durationMinutes: 30, billable: false }),
      makeEntry('calendar', { id: 'c', durationMinutes: 60, billable: undefined }),
      makeEntry('break', { id: 'd', durationMinutes: 5 }),
      makeEntry('logged', { id: 'e', durationMinutes: 15 }),
      makeEntry('proposal', { id: 'f', durationMinutes: 45 }),
    ));
    expect(stats.trackedMinutes).toBe(25 + 30 + 60 + 15 + 45);
    expect(stats.billableMinutes).toBe(25 + 60 + 15);
    expect(stats.breakMinutes).toBe(5);
    expect(stats.markedCount).toBe(3);
    expect(stats.loggedCount).toBe(1);
    expect(stats.toggleableCount).toBe(3);
    expect(stats.allSelected).toBe(true);
  });

  it('an unaccepted proposal counts as tracked (old Daily Log total parity) but never as billable', () => {
    const stats = dayStats(rows(makeEntry('proposal', { id: 'p', durationMinutes: 510, billable: true })));
    expect(stats.trackedMinutes).toBe(510);
    expect(stats.billableMinutes).toBe(0);
    const accepted = dayStats(rows(makeEntry('calendar', { id: 'c', durationMinutes: 510, billable: true })));
    expect(accepted.billableMinutes).toBe(510);
  });

  it('allSelected is false with no toggleable rows or with an unmarked one', () => {
    expect(dayStats([]).allSelected).toBe(false);
    expect(dayStats(rows(makeEntry('pomodoro', { markedToLog: false }))).allSelected).toBe(false);
  });
});

describe('reviewLogic.selectionSummary', () => {
  it('counts marked unlogged non-break rows and those without a task', () => {
    const s = selectionSummary(rows(
      makeEntry('pomodoro', { id: 'a', durationMinutes: 25 }),
      makeEntry('adhoc', { id: 'b', durationMinutes: 80, taskId: null }),
      makeEntry('pomodoro', { id: 'c', markedToLog: false, taskId: null }),
      makeEntry('logged', { id: 'd', markedToLog: true }),
      makeEntry('break', { id: 'e', markedToLog: true }),
    ));
    expect(s).toEqual({ selectedCount: 2, selectedMinutes: 105, needsTaskCount: 1 });
  });
});

describe('reviewLogic dates', () => {
  it('dateLabel formats `Fri 25 Sep` and flags today', () => {
    expect(dateLabel('2026-09-25', '2026-09-25')).toEqual({ text: 'Fri 25 Sep', isToday: true });
    expect(dateLabel('2026-09-24', '2026-09-25')).toEqual({ text: 'Thu 24 Sep', isToday: false });
    expect(dateLabel('2026-12-31', '2027-01-01')).toEqual({ text: 'Thu 31 Dec', isToday: false });
    expect(dateLabel('2027-01-01', '2027-01-01').text).toBe('Fri 1 Jan');
  });

  it('shiftDate uses local calendar arithmetic across month and DST boundaries', () => {
    expect(shiftDate('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftDate('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftDate('2026-03-29', 1)).toBe('2026-03-30'); // EU DST switch
    expect(shiftDate('2026-10-25', 1)).toBe('2026-10-26');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('nextWorkday skips weekends', () => {
    expect(nextWorkday('2026-09-25')).toBe('2026-09-28'); // Fri → Mon
    expect(nextWorkday('2026-09-26')).toBe('2026-09-28'); // Sat → Mon
    expect(nextWorkday('2026-09-27')).toBe('2026-09-28'); // Sun → Mon
    expect(nextWorkday('2026-09-28')).toBe('2026-09-29'); // Mon → Tue
    expect(nextWorkday('2026-09-24')).toBe('2026-09-25'); // Thu → Fri
  });

  it('tomorrowLabel reads `Mon 28 Sep` from a Friday', () => {
    expect(tomorrowLabel('2026-09-25')).toBe('Mon 28 Sep');
  });
});

describe('reviewLogic.tomorrowCalendar', () => {
  const p = (minutes: number, dismissed: 0 | 1 = 0): CalendarProposal => ({
    id: `p${minutes}`, event_uid: 'u', title: 'M', start_at: '', end_at: '', duration_minutes: minutes, date: FIXTURE_DATE,
    accepted: 0, dismissed, task_id: null, comment: null, logged: 0,
  });

  it('counts non-dismissed meetings and floors free time at 0 using DAY_TARGET_MINUTES', () => {
    expect(DAY_TARGET_MINUTES).toBe(360);
    expect(tomorrowCalendar([p(60), p(30), p(45, 1)])).toEqual({ meetings: 2, meetingMinutes: 90, freeMinutes: 270 });
    expect(tomorrowCalendar([p(300), p(120)])).toEqual({ meetings: 2, meetingMinutes: 420, freeMinutes: 0 });
    expect(tomorrowCalendar([])).toEqual({ meetings: 0, meetingMinutes: 0, freeMinutes: 360 });
  });
});

describe('reviewLogic.rowModel', () => {
  it('open pomodoro row: amber dot, every capability, comment hidden when equal to the title', () => {
    const m = rowModel(asMerged(makeEntry('pomodoro', { startTime: `${FIXTURE_DATE}T09:05:00`, durationMinutes: 85 })));
    expect(m).toMatchObject({
      kind: 'open', dotClass: 'bg-focus', timeText: '09:05', durText: '1h 25m', primaryText: 'Focus session', secondaryText: null,
      canToggle: true, canEdit: true, canMove: true, canDelete: true, canAcceptDismiss: false, billableInteractive: true, billable: true,
    });
  });

  it('shows the comment as secondary text only when it differs from the title (R5)', () => {
    expect(rowModel(asMerged(makeEntry('adhoc', { title: 'Call', comment: 'Follow-up notes' }))).secondaryText).toBe('Follow-up notes');
    expect(rowModel(asMerged(makeEntry('adhoc', { title: 'Call', comment: '   ' }))).secondaryText).toBeNull();
    expect(rowModel(asMerged(makeEntry('adhoc', { title: 'Call', comment: null }))).secondaryText).toBeNull();
  });

  it('calendar rows use the blue dot; proposals expose Accept / Dismiss and no toggle / edit', () => {
    expect(rowModel(asMerged(makeEntry('calendar'))).dotClass).toBe('bg-blue-400');
    const p = rowModel(asMerged(makeEntry('proposal')));
    expect(p).toMatchObject({ kind: 'proposal', canToggle: false, canEdit: false, canMove: false, canDelete: false, canAcceptDismiss: true, billableInteractive: true });
  });

  it('logged rows are read-only with a static billable state', () => {
    const l = rowModel(asMerged(makeEntry('logged', { billable: false })));
    expect(l).toMatchObject({ kind: 'logged', canToggle: false, canEdit: false, canMove: false, canDelete: false, billableInteractive: false, billable: false });
  });

  it('break rows: emerald dot, `Break` text, unscheduled time when missing, no capabilities', () => {
    const b = rowModel(asMerged(makeEntry('break', { startTime: null })));
    expect(b).toMatchObject({ kind: 'break', dotClass: 'bg-break', timeText: '--:--', durText: '5m', primaryText: 'Break', secondaryText: null, canToggle: false, canEdit: false, canDelete: false, billableInteractive: false });
  });
});

describe('reviewLogic misc', () => {
  it('buildEPLink filters the day for the hard-coded user', () => {
    const url = new URL(buildEPLink('2026-09-25'));
    expect(url.origin + url.pathname).toBe('https://es.easyproject.com/easy_time_entries');
    expect(url.searchParams.get('only_me')).toBe('true');
    expect(url.searchParams.get('set_filter')).toBe('1');
    expect(url.searchParams.get('spent_on')).toBe('2026-09-25|2026-09-25');
    expect(url.searchParams.get('user_id')).toBe('28668');
  });

  it('errorHint classifies the main-process and api strings', () => {
    expect(errorHint('Invalid API key (401)')).toEqual({ kind: '401', action: 'settings' });
    expect(errorHint('API not configured. Please add your API key in Settings.')).toEqual({ kind: '401', action: 'settings' });
    expect(errorHint('Issue not found (404)')).toEqual({ kind: '404' });
    expect(errorHint('Issue #643749 not found (404)')).toEqual({ kind: '404' });
    expect(errorHint('Validation error: hours is invalid')).toEqual({ kind: '422' });
    expect(errorHint('API error: 503')).toEqual({ kind: 'server' });
    expect(errorHint('Blocked: posting time entries is disabled in dev builds')).toEqual({ kind: 'other' });
    expect(errorHint('Task ID is required')).toEqual({ kind: 'other' });
  });

  it('formatTimeOfDay pads and handles null / invalid', () => {
    expect(formatTimeOfDay(`${FIXTURE_DATE}T08:06:14`)).toBe('08:06');
    expect(formatTimeOfDay(null)).toBe('--:--');
    expect(formatTimeOfDay('nonsense')).toBe('--:--');
  });

  it('formatMinutesPadded reads `5h 40m`, `2h 05m`, `45m`, and `6h` with no zero minutes (as Plan / Now)', () => {
    expect(formatMinutesPadded(340)).toBe('5h 40m');
    expect(formatMinutesPadded(125)).toBe('2h 05m');
    expect(formatMinutesPadded(45)).toBe('45m');
    expect(formatMinutesPadded(0)).toBe('0m');
    expect(formatMinutesPadded(360)).toBe('6h');
  });
});

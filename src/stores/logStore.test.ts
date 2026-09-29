import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLogStore } from './logStore';
import { makeEntry, FIXTURE_DATE } from '../test/logFixtures';
import type { AdhocEntry, CalendarProposal, PomodoroSession } from '../types';

// The store syncs the ICS feed on every `loadDay`; keep the tests off the feed and the DB.
vi.mock('../services/calendar', () => ({
  syncCalendarProposals: vi.fn(async () => undefined),
  forceSyncCalendar: vi.fn(async () => undefined),
  invalidateCalendarCache: vi.fn(),
  getLastSyncTime: vi.fn(() => null),
}));

const ISSUE = { taskId: '643749', title: 'Feature X', projectId: 6562, projectName: 'Drip' };
const BLOCKED = 'Blocked: posting time entries is disabled in dev builds';

function session(overrides: Partial<PomodoroSession> = {}): PomodoroSession {
  return {
    id: 's1', start_at: `${FIXTURE_DATE}T09:00:00.000Z`, end_at: null, duration_minutes: 25, task_id: '643749',
    source: 'pomodoro', comment: 'Dev work', logged: 0, log_sent_at: null, server_entry_id: null, billable: 1, ...overrides,
  };
}

function adhoc(overrides: Partial<AdhocEntry> = {}): AdhocEntry {
  return {
    id: 'a1', created_at: '', date: FIXTURE_DATE, duration_minutes: 30, title: 'Manual', task_id: '643749', is_todo: 0,
    due_date: null, completed: 0, marked_to_log: 1, logged: 0, comment: null, billable: 1, start_time: null, ...overrides,
  };
}

function proposal(overrides: Partial<CalendarProposal> = {}): CalendarProposal {
  return {
    id: 'c1', event_uid: 'uid', title: 'Standup', start_at: `${FIXTURE_DATE}T09:40:00.000Z`, end_at: `${FIXTURE_DATE}T10:10:00.000Z`,
    duration_minutes: 30, date: FIXTURE_DATE, accepted: 1, dismissed: 0, task_id: '643749', comment: null, logged: 0, billable: 1, ...overrides,
  };
}

function expectedPayload(extra: Partial<Record<string, unknown>> = {}) {
  return {
    time_entry: {
      project_id: 6562, issue_id: 643749, user_id: 28668, activity_id: 95, hours: 0.5,
      spent_on: FIXTURE_DATE, comments: 'Dev work', easy_is_billable: true, ...extra,
    },
  };
}

beforeEach(() => {
  useLogStore.setState({ entries: [], selectedDate: FIXTURE_DATE, isLoading: false, viewMode: 'list' });
  window.timerAPI.getIssue = vi.fn(async () => ISSUE);
});

describe('logStore — safety: posting reaches the network only through the IPC bridge', () => {
  it('logSelected posts one session via timerAPI.postTimeEntry with the exact payload and never calls fetch', async () => {
    useLogStore.setState({ entries: [makeEntry('pomodoro', { id: 's1', durationMinutes: 30, comment: 'Dev work' })] });

    const result = await useLogStore.getState().logSelected();

    expect(window.timerAPI.postTimeEntry).toHaveBeenCalledTimes(1);
    expect(window.timerAPI.postTimeEntry).toHaveBeenCalledWith('https://example.test', 'test-key', expectedPayload());
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(window.logAPI.updateSession).toHaveBeenCalledWith('s1', expect.objectContaining({ logged: 1, server_entry_id: 1001, log_sent_at: expect.any(String) }));
    expect(result).toMatchObject({ success: 1, failed: 0, errors: [] });
  });

  it('logSelected marks an adhoc row logged after the IPC post', async () => {
    useLogStore.setState({ entries: [makeEntry('adhoc', { id: 'a1', comment: 'Dev work' })] });
    const result = await useLogStore.getState().logSelected();
    expect(window.timerAPI.postTimeEntry).toHaveBeenCalledWith('https://example.test', 'test-key', expectedPayload());
    expect(window.logAPI.updateAdhocEntry).toHaveBeenCalledWith('a1', { logged: 1 });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: 1, failed: 0 });
  });

  it('logSelected marks an accepted calendar row logged and sends its billable flag (R7)', async () => {
    useLogStore.setState({ entries: [makeEntry('calendar', { id: 'c1', comment: 'Dev work', billable: false })] });
    const result = await useLogStore.getState().logSelected();
    expect(window.timerAPI.postTimeEntry).toHaveBeenCalledWith('https://example.test', 'test-key', expectedPayload({ easy_is_billable: false }));
    expect(window.logAPI.updateCalendarProposal).toHaveBeenCalledWith('c1', { logged: 1 });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: 1, failed: 0 });
  });

  it('without the IPC bridge the renderer throws the dev block, never fetches, and marks nothing', async () => {
    delete (window.timerAPI as { postTimeEntry?: unknown }).postTimeEntry;
    useLogStore.setState({ entries: [makeEntry('pomodoro', { id: 's1' })] });

    const result = await useLogStore.getState().logSelected();

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(window.logAPI.updateSession).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toEqual({ entryId: 's1', error: BLOCKED });
  });

  it('a main-process block surfaces as a failed row and marks nothing', async () => {
    window.timerAPI.postTimeEntry = vi.fn(async () => { throw new Error(BLOCKED); });
    useLogStore.setState({ entries: [makeEntry('pomodoro', { id: 's1' })] });
    const result = await useLogStore.getState().logSelected();
    expect(result).toMatchObject({ success: 0, failed: 1 });
    expect(result.errors[0].error).toBe(BLOCKED);
    expect(window.logAPI.updateSession).not.toHaveBeenCalled();
  });

  it.each([
    'Invalid API key (401)',
    'Issue not found (404)',
    'Validation error: hours is invalid',
    'API error: 500',
  ])('server error "%s" is collected per entry and the row stays unlogged', async (message) => {
    window.timerAPI.postTimeEntry = vi.fn(async () => { throw new Error(message); });
    useLogStore.setState({ entries: [makeEntry('pomodoro', { id: 's1' })] });
    const result = await useLogStore.getState().logSelected();
    expect(result.errors).toEqual([{ entryId: 's1', error: message }]);
    expect(window.logAPI.updateSession).not.toHaveBeenCalled();
  });

  it('a mix of one success and one 404 marks only the successful row', async () => {
    window.timerAPI.postTimeEntry = vi.fn()
      .mockResolvedValueOnce(1001)
      .mockRejectedValueOnce(new Error('Issue not found (404)'));
    useLogStore.setState({ entries: [makeEntry('pomodoro', { id: 's1' }), makeEntry('adhoc', { id: 'a1' })] });
    const result = await useLogStore.getState().logSelected();
    expect(result).toMatchObject({ success: 1, failed: 1 });
    expect(result.errors).toEqual([{ entryId: 'a1', error: 'Issue not found (404)' }]);
    expect(window.logAPI.updateSession).toHaveBeenCalledWith('s1', expect.objectContaining({ logged: 1 }));
    expect(window.logAPI.updateAdhocEntry).not.toHaveBeenCalledWith('a1', { logged: 1 });
  });

  it('a getIssue failure (API not configured) means no post at all', async () => {
    window.timerAPI.getSettings = vi.fn(async () => null);
    useLogStore.setState({ entries: [makeEntry('pomodoro', { id: 's1' })] });
    const result = await useLogStore.getState().logSelected();
    expect(window.timerAPI.postTimeEntry).not.toHaveBeenCalled();
    expect(result.errors[0].error).toMatch(/API not configured/);
  });

  it('rows without a task id are blocked, never sent and never errored (R22); zero duration fails validation', async () => {
    useLogStore.setState({ entries: [
      makeEntry('adhoc', { id: 'a1', taskId: null }),
      makeEntry('pomodoro', { id: 's1', durationMinutes: 0 }),
    ] });
    const result = await useLogStore.getState().logSelected();
    expect(window.timerAPI.getIssue).not.toHaveBeenCalled();
    expect(window.timerAPI.postTimeEntry).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: 0, failed: 1 });
    expect(result.errors).toEqual([{ entryId: 's1', error: 'Duration must be greater than 0' }]);
  });

  it('skips unmarked, logged and break rows', async () => {
    useLogStore.setState({ entries: [
      makeEntry('pomodoro', { id: 'u', markedToLog: false }),
      makeEntry('logged', { id: 'l', markedToLog: true }),
      makeEntry('break', { id: 'b', markedToLog: true }),
    ] });
    const result = await useLogStore.getState().logSelected();
    expect(window.timerAPI.postTimeEntry).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: 0, failed: 0 });
  });

  it('logEntryNow saves the adhoc row first, posts via IPC only, then marks it logged', async () => {
    const result = await useLogStore.getState().logEntryNow({
      date: FIXTURE_DATE, durationMinutes: 30, title: 'Manual', taskId: '643749', comment: 'Dev work', billable: true,
    });
    expect(window.logAPI.addAdhocEntry).toHaveBeenCalledWith(expect.objectContaining({ task_id: '643749', marked_to_log: 1, logged: 0 }));
    expect(window.timerAPI.postTimeEntry).toHaveBeenCalledWith('https://example.test', 'test-key', expectedPayload());
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(window.logAPI.updateAdhocEntry).toHaveBeenCalledWith('new-adhoc', { logged: 1 });
    expect(result).toEqual({ success: true });
  });

  it('logEntryNow leaves the row saved and marked-to-log when the post fails', async () => {
    window.timerAPI.postTimeEntry = vi.fn(async () => { throw new Error('API error: 503'); });
    const result = await useLogStore.getState().logEntryNow({
      date: FIXTURE_DATE, durationMinutes: 30, title: 'Manual', taskId: '643749', comment: null, billable: true,
    });
    expect(window.logAPI.addAdhocEntry).toHaveBeenCalledWith(expect.objectContaining({ marked_to_log: 1 }));
    expect(window.logAPI.updateAdhocEntry).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, error: 'API error: 503' });
  });
});

describe('logStore — loadDay mapping', () => {
  it('maps the three tables, names breaks, marks per table rules, sorts by start with nulls last', async () => {
    window.logAPI.getSessions = vi.fn(async () => [
      session({ id: 's2', start_at: `${FIXTURE_DATE}T11:00:00.000Z` }),
      session({ id: 'b1', source: 'break', comment: null, start_at: `${FIXTURE_DATE}T09:25:00.000Z` }),
      session({ id: 's1' }),
    ]);
    window.logAPI.getAdhocEntries = vi.fn(async () => [adhoc({ id: 'a1', marked_to_log: 0 }), adhoc({ id: 'a2', start_time: `${FIXTURE_DATE}T08:00:00.000Z` })]);
    window.logAPI.getCalendarProposals = vi.fn(async () => [
      proposal({ id: 'c1', accepted: 0 }),
      proposal({ id: 'c2', accepted: 1, billable: 0 }),
      proposal({ id: 'c3', dismissed: 1 }),
      proposal({ id: 'c4', accepted: 1, billable: undefined, start_at: `${FIXTURE_DATE}T12:00:00.000Z` }),
    ]);

    await useLogStore.getState().loadDay(FIXTURE_DATE);
    const entries = useLogStore.getState().entries;

    expect(entries.map(e => e.id)).toEqual(['a2', 's1', 'b1', 'c1', 'c2', 's2', 'c4', 'a1']);
    const byId = Object.fromEntries(entries.map(e => [e.id, e]));
    expect(byId.b1).toMatchObject({ title: 'Break', source: 'break', markedToLog: false });
    expect(byId.s1).toMatchObject({ title: 'Dev work', markedToLog: true, billable: true });
    expect(byId.a1).toMatchObject({ type: 'adhoc', markedToLog: false });
    expect(byId.a2).toMatchObject({ markedToLog: true });
    expect(byId.c1).toMatchObject({ isProposal: true, markedToLog: false, billable: true });
    expect(byId.c2).toMatchObject({ isProposal: false, markedToLog: true, billable: false });
    expect(byId.c4.billable).toBe(true); // column missing on old rows → billable
    expect(byId.c3).toBeUndefined();
  });
});

describe('logStore — marks, edits, deletes, moves', () => {
  it('toggleLogMark persists marked_to_log for adhoc only and refuses logged / proposal rows', async () => {
    useLogStore.setState({ entries: [
      makeEntry('adhoc', { id: 'a1', markedToLog: true }),
      makeEntry('pomodoro', { id: 's1', markedToLog: true }),
      makeEntry('logged', { id: 'l1' }),
      makeEntry('proposal', { id: 'p1' }),
    ] });
    const store = useLogStore.getState();
    await store.toggleLogMark('a1');
    await store.toggleLogMark('s1');
    await store.toggleLogMark('l1');
    await store.toggleLogMark('p1');
    expect(window.logAPI.updateAdhocEntry).toHaveBeenCalledTimes(1);
    expect(window.logAPI.updateAdhocEntry).toHaveBeenCalledWith('a1', { marked_to_log: 0 });
    const byId = Object.fromEntries(useLogStore.getState().entries.map(e => [e.id, e]));
    expect(byId.a1.markedToLog).toBe(false);
    expect(byId.s1.markedToLog).toBe(false);
    expect(byId.l1.markedToLog).toBe(false);
    expect(byId.p1.markedToLog).toBe(false);
  });

  it('toggleSelectAll marks every loggable row (persisting adhoc only), then unmarks', async () => {
    useLogStore.setState({ entries: [
      makeEntry('adhoc', { id: 'a1', markedToLog: false }),
      makeEntry('pomodoro', { id: 's1', markedToLog: true }),
      makeEntry('proposal', { id: 'p1' }),
      makeEntry('logged', { id: 'l1' }),
      makeEntry('adhoc', { id: 'n1', taskId: null, markedToLog: false }),
      makeEntry('break', { id: 'b1' }),
    ] });
    await useLogStore.getState().toggleSelectAll();
    expect(window.logAPI.updateAdhocEntry).toHaveBeenCalledWith('a1', { marked_to_log: 1 });
    expect(window.logAPI.updateSession).not.toHaveBeenCalled();
    let byId = Object.fromEntries(useLogStore.getState().entries.map(e => [e.id, e]));
    expect(byId.a1.markedToLog).toBe(true);
    expect(byId.s1.markedToLog).toBe(true);
    expect(byId.p1.markedToLog).toBe(false);
    expect(byId.l1.markedToLog).toBe(false);
    // R22: a row without a task and a break are never selected
    expect(byId.n1.markedToLog).toBe(false);
    expect(byId.b1.markedToLog).toBe(false);
    expect(window.logAPI.updateAdhocEntry).not.toHaveBeenCalledWith('n1', expect.anything());

    await useLogStore.getState().toggleSelectAll();
    byId = Object.fromEntries(useLogStore.getState().entries.map(e => [e.id, e]));
    expect(byId.a1.markedToLog).toBe(false);
    expect(byId.s1.markedToLog).toBe(false);
  });

  it('updateEntry sends only the fields present, per type, including calendar billable (R7)', async () => {
    useLogStore.setState({ entries: [
      makeEntry('pomodoro', { id: 's1' }), makeEntry('adhoc', { id: 'a1' }), makeEntry('calendar', { id: 'c1' }),
    ] });
    // Every write reloads the day from the (empty) stubs, so re-seed between calls.
    const seed = () => useLogStore.setState({ entries: [
      makeEntry('pomodoro', { id: 's1' }), makeEntry('adhoc', { id: 'a1' }), makeEntry('calendar', { id: 'c1' }),
    ] });
    const store = useLogStore.getState();
    await store.updateEntry('s1', { billable: false });
    expect(window.logAPI.updateSession).toHaveBeenCalledWith('s1', { billable: 0 });
    seed();
    await store.updateEntry('a1', { comment: 'Edited', durationMinutes: 45 });
    expect(window.logAPI.updateAdhocEntry).toHaveBeenCalledWith('a1', { comment: 'Edited', duration_minutes: 45 });
    seed();
    await store.updateEntry('c1', { billable: false });
    expect(window.logAPI.updateCalendarProposal).toHaveBeenCalledWith('c1', { billable: 0 });
    seed();
    await store.updateEntry('c1', { taskId: '123', comment: '' });
    expect(window.logAPI.updateCalendarProposal).toHaveBeenLastCalledWith('c1', { task_id: '123', comment: null });
    const calendarCalls = vi.mocked(window.logAPI.updateCalendarProposal!).mock.calls;
    expect(calendarCalls.every(([, u]) => !('title' in u))).toBe(true);
  });

  it('deleteEntry refuses logged rows with a notification and dismisses calendar rows', async () => {
    const seed = () => useLogStore.setState({ entries: [makeEntry('logged', { id: 'l1' }), makeEntry('calendar', { id: 'c1' }), makeEntry('pomodoro', { id: 's1' }), makeEntry('adhoc', { id: 'a1' })] });
    seed();
    const store = useLogStore.getState();
    await store.deleteEntry('l1');
    expect(window.timerAPI.showNotification).toHaveBeenCalledWith('Cannot Delete', 'This entry has already been logged to Easy Project');
    expect(window.logAPI.deleteSession).not.toHaveBeenCalled();
    await store.deleteEntry('c1');
    expect(window.logAPI.dismissCalendarProposal).toHaveBeenCalledWith('c1');
    seed();
    await store.deleteEntry('s1');
    expect(window.logAPI.deleteSession).toHaveBeenCalledWith('s1');
    seed();
    await store.deleteEntry('a1');
    expect(window.logAPI.deleteAdhocEntry).toHaveBeenCalledWith('a1');
  });

  it('moveEntries rewrites the date part for the three types, single id or all marked', async () => {
    const seed = () => useLogStore.setState({ entries: [
      makeEntry('pomodoro', { id: 's1', startTime: `${FIXTURE_DATE}T08:06:14.742Z` }),
      makeEntry('adhoc', { id: 'a1' }),
      makeEntry('calendar', { id: 'c1', startTime: `${FIXTURE_DATE}T09:40:00.000Z`, durationMinutes: 30 }),
      makeEntry('pomodoro', { id: 's2', markedToLog: false }),
    ] });
    seed();
    await useLogStore.getState().moveEntries('2026-09-28', ['s1']);
    expect(window.logAPI.updateSession).toHaveBeenCalledWith('s1', { start_at: '2026-09-28T08:06:14.742Z' });
    expect(window.logAPI.updateAdhocEntry).not.toHaveBeenCalled();
    seed();

    await useLogStore.getState().moveEntries('2026-09-28');
    expect(window.logAPI.updateAdhocEntry).toHaveBeenCalledWith('a1', { date: '2026-09-28' });
    expect(window.logAPI.updateCalendarProposal).toHaveBeenCalledWith('c1', {
      date: '2026-09-28', start_at: '2026-09-28T09:40:00.000Z', end_at: '2026-09-28T10:10:00.000Z',
    });
    expect(window.logAPI.updateSession).not.toHaveBeenCalledWith('s2', expect.anything());
  });

  it('addManualEntry converts HH:MM into an ISO start_time on the selected date', async () => {
    await useLogStore.getState().addManualEntry({ title: 'Call', durationMinutes: 15, startTime: '09:30' } as never);
    const [[row]] = vi.mocked(window.logAPI.addAdhocEntry).mock.calls;
    expect(row).toMatchObject({ date: FIXTURE_DATE, title: 'Call', duration_minutes: 15, marked_to_log: 1, billable: 1 });
    const local = new Date(row.start_time as string);
    expect([local.getHours(), local.getMinutes()]).toEqual([9, 30]);
  });

  it('persists viewMode only — selectedDate is session state (R1)', () => {
    const persisted = JSON.parse(localStorage.getItem('log-storage') || '{}');
    expect(persisted.state ?? {}).not.toHaveProperty('selectedDate');
    useLogStore.setState({ viewMode: 'timeline', selectedDate: '2020-01-01' });
    const after = JSON.parse(localStorage.getItem('log-storage') || '{}');
    expect(after.state).toEqual({ viewMode: 'timeline' });
  });

  it('ignores a selectedDate left in storage by older builds (R1)', async () => {
    useLogStore.setState({ selectedDate: '2026-09-25', viewMode: 'list' });
    localStorage.setItem('log-storage', JSON.stringify({ state: { viewMode: 'timeline', selectedDate: '2026-09-10' }, version: 0 }));
    await useLogStore.persist.rehydrate();
    expect(useLogStore.getState().selectedDate).toBe('2026-09-25');
    expect(useLogStore.getState().viewMode).toBe('timeline');
  });
});

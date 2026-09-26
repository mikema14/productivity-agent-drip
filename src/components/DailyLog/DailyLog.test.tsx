import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DailyLog from './DailyLog';
import { useLogStore, type LogEntry } from '../../stores/logStore';
import { makeEntry, FIXTURE_DATE } from '../../test/logFixtures';
import { forceSyncCalendar, invalidateCalendarCache, syncCalendarProposals } from '../../services/calendar';
import { useListsStore } from '../../stores/listsStore';

vi.mock('../../services/calendar', () => ({
  syncCalendarProposals: vi.fn(async () => undefined),
  forceSyncCalendar: vi.fn(async () => undefined),
  invalidateCalendarCache: vi.fn(),
  getLastSyncTime: vi.fn(() => null),
}));

vi.mock('./AddEntryModal', () => ({
  default: ({ onClose, onAdd }: { onClose: () => void; onAdd: (e: unknown) => void }) => (
    <div data-testid="add-entry-modal">
      <button onClick={() => onAdd({ durationMinutes: 30, title: 'Manual', taskId: null, comment: null, billable: true, startTime: '10:15' })}>add stub</button>
      <button onClick={onClose}>close add</button>
    </div>
  ),
}));
vi.mock('./TemplateManagerModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="template-modal" /> : null),
}));
vi.mock('./EndDayModal', () => ({
  default: ({ initialReflection, tomorrowDate }: { initialReflection?: string; tomorrowDate?: string }) => (
    <div data-testid="end-day-modal" data-reflection={initialReflection} data-tomorrow={tomorrowDate} />
  ),
}));
vi.mock('./CalendarPopover', () => ({
  default: ({ onSelectDate, onClose }: { onSelectDate: (d: string) => void; onClose: () => void }) => (
    <div data-testid="calendar-popover">
      <button onClick={() => onSelectDate('2026-09-01')}>pick 1 Sep</button>
      <button onClick={onClose}>close popover</button>
    </div>
  ),
}));
vi.mock('./TodaysThree', () => ({ default: () => <section aria-label="Today">TodayStub</section> }));
vi.mock('./TimelineView', () => ({
  default: ({ entries }: { entries: LogEntry[] }) => <div data-testid="timeline-view">{entries.length} timeline entries</div>,
}));

const today = new Date().toISOString().split('T')[0];

type Actions = Pick<ReturnType<typeof useLogStore.getState>,
  'loadDay' | 'addManualEntry' | 'updateEntry' | 'deleteEntry' | 'toggleLogMark' | 'toggleSelectAll' | 'logSelected' | 'moveEntries'>;

function stubActions(): Actions {
  const actions: Actions = {
    loadDay: vi.fn(async () => undefined),
    addManualEntry: vi.fn(async () => undefined),
    updateEntry: vi.fn(async () => undefined),
    deleteEntry: vi.fn(async () => undefined),
    toggleLogMark: vi.fn(),
    toggleSelectAll: vi.fn(async () => undefined),
    logSelected: vi.fn(async () => ({ success: 0, failed: 0, errors: [] })),
    moveEntries: vi.fn(async () => undefined),
  };
  useLogStore.setState(actions);
  return actions;
}

async function renderLog(entries: LogEntry[] = [], date = FIXTURE_DATE, viewMode: 'list' | 'timeline' = 'list') {
  const actions = stubActions();
  useLogStore.setState({ entries, selectedDate: date, isLoading: false, viewMode });
  const onNavigate = vi.fn();
  render(<DailyLog onNavigate={onNavigate} />);
  await act(async () => { await Promise.resolve(); });
  return { ...actions, onNavigate, user: userEvent.setup() };
}

const table = () => screen.getByRole('region', { name: 'Time entries' });
const footer = () => screen.getByTestId('entries-footer');
const toolbar = () => screen.getByTestId('entries-toolbar');

describe('DailyLog (Review)', () => {
  beforeEach(() => {
    useLogStore.setState({ entries: [], selectedDate: FIXTURE_DATE, viewMode: 'list', isLoading: false });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Review with the date, loads the day on mount and shows header stats', async () => {
    const { loadDay } = await renderLog([makeEntry('pomodoro'), makeEntry('break', { id: 'b1' })], today);
    expect(screen.getByRole('heading', { name: 'Review' })).toBeInTheDocument();
    expect(screen.getByTestId('review-date')).toHaveTextContent('· Today');
    expect(loadDay).toHaveBeenCalledWith(today);
    const stats = screen.getByTestId('review-stats');
    expect(stats).toHaveTextContent('25m tracked');
    expect(stats).toHaveTextContent('1 to log');
    expect(stats).toHaveTextContent('5m break');
  });

  it('prev / next shift selectedDate by one day; the date button opens the month grid', async () => {
    const { user } = await renderLog([]);
    await user.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(useLogStore.getState().selectedDate).toBe('2026-09-24');
    await user.click(screen.getByRole('button', { name: 'Next day' }));
    await user.click(screen.getByRole('button', { name: 'Next day' }));
    expect(useLogStore.getState().selectedDate).toBe('2026-09-26');
    await user.click(screen.getByTestId('review-date'));
    await user.click(screen.getByText('pick 1 Sep'));
    expect(useLogStore.getState().selectedDate).toBe('2026-09-01');
  });

  it('Sync calls forceSyncCalendar then loadDay(date, true) and notifies', async () => {
    const { user, loadDay } = await renderLog([]);
    await user.click(screen.getByRole('button', { name: 'Sync calendar' }));
    expect(forceSyncCalendar).toHaveBeenCalledWith(FIXTURE_DATE);
    expect(loadDay).toHaveBeenCalledWith(FIXTURE_DATE, true);
    expect(window.timerAPI.showNotification).toHaveBeenCalledWith('Calendar Refreshed', 'Latest events synced');
  });

  it('empty day shows the CTA and opens AddEntryModal; adding passes startTime to addManualEntry', async () => {
    const { user, addManualEntry } = await renderLog([]);
    expect(screen.getByText('No entries for this day')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add your first entry' }));
    expect(screen.getByTestId('add-entry-modal')).toBeInTheDocument();
    await user.click(screen.getByText('add stub'));
    expect(addManualEntry).toHaveBeenCalledWith(expect.objectContaining({ startTime: '10:15', durationMinutes: 30 }));
  });

  it('shows the loading text while the first load runs', async () => {
    stubActions();
    useLogStore.setState({ entries: [], selectedDate: FIXTURE_DATE, isLoading: true });
    render(<DailyLog />);
    expect(screen.getByText('Loading entries...')).toBeInTheDocument();
  });

  it('renders work rows before break rows with the column header', async () => {
    await renderLog([makeEntry('break', { id: 'b1', startTime: `${FIXTURE_DATE}T08:00:00.000` }), makeEntry('pomodoro')]);
    expect(screen.getByTestId('entries-columns')).toHaveTextContent('Time');
    const rows = screen.getAllByTestId('entry-row');
    expect(rows.map(r => r.getAttribute('data-kind'))).toEqual(['open', 'break']);
  });

  it('Timeline renders TimelineView (mocked), hides the column header and Group by task, persists viewMode', async () => {
    const { user } = await renderLog([makeEntry('pomodoro')]);
    expect(screen.getByRole('button', { name: 'Group by task' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Timeline' }));
    expect(screen.getByTestId('timeline-view')).toHaveTextContent('1 timeline entries');
    expect(screen.queryByTestId('entries-columns')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Group by task' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Timeline' })).toHaveAttribute('aria-pressed', 'true');
    expect(useLogStore.getState().viewMode).toBe('timeline');
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(useLogStore.getState().viewMode).toBe('list');
  });

  it('Move to… is hidden at 0 marked and opens the popover when marked; bulk → moveEntries(date, undefined)', async () => {
    const { user, moveEntries } = await renderLog([makeEntry('pomodoro', { markedToLog: false })]);
    expect(screen.queryByRole('button', { name: 'Move to…' })).toBeNull();
    useLogStore.setState({ entries: [makeEntry('pomodoro')] });
    await user.click(await screen.findByRole('button', { name: 'Move to…' }));
    await user.click(within(toolbar()).getByText('pick 1 Sep'));
    expect(moveEntries).toHaveBeenCalledWith('2026-09-01', undefined);
    expect(window.timerAPI.showNotification).toHaveBeenCalledWith('Entries Moved', '1 entry moved to 2026-09-01');
  });

  it('row Move → moveEntries(date, [id])', async () => {
    const { user, moveEntries } = await renderLog([makeEntry('pomodoro')]);
    await user.click(screen.getByRole('button', { name: 'Move' }));
    await user.click(screen.getByText('pick 1 Sep'));
    expect(moveEntries).toHaveBeenCalledWith('2026-09-01', ['pomodoro-1']);
  });

  it('Log button is disabled at 0 selected and labelled Log N to Easy8 when marked', async () => {
    const { user, logSelected } = await renderLog([makeEntry('pomodoro', { markedToLog: false })]);
    const idle = within(footer()).getByRole('button', { name: 'Log to Easy8' });
    expect(idle).toBeDisabled();
    expect(idle).toHaveAttribute('title', 'Mark entries to log');
    useLogStore.setState({ entries: [makeEntry('pomodoro'), makeEntry('adhoc', { id: 'a1' })] });
    const key = await within(footer()).findByRole('button', { name: 'Log 2 to Easy8' });
    expect(footer()).toHaveTextContent('2 selected · 55m');
    await user.click(key);
    expect(logSelected).toHaveBeenCalledTimes(1);
  });

  it('shows the success toast with the count; the link opens the EP URL', async () => {
    const { user, logSelected } = await renderLog([makeEntry('pomodoro')]);
    vi.mocked(logSelected).mockResolvedValue({ success: 1, failed: 0, errors: [] });
    await user.click(within(footer()).getByRole('button', { name: 'Log 1 to Easy8' }));
    expect(await screen.findByText('✓ 1 entry logged')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View in Easy Project →' }));
    expect(window.timerAPI.openExternal).toHaveBeenCalledWith(expect.stringContaining('/easy_time_entries?'));
    expect(vi.mocked(window.timerAPI.openExternal).mock.calls[0]?.[0]).toContain(FIXTURE_DATE);
  });

  it('renders per-row log errors; 401 shows the banner and Open Settings → onNavigate("settings")', async () => {
    const { user, logSelected, onNavigate } = await renderLog([makeEntry('pomodoro'), makeEntry('adhoc', { id: 'a1' })]);
    vi.mocked(logSelected).mockResolvedValue({
      success: 0, failed: 2,
      errors: [{ entryId: 'pomodoro-1', error: 'Issue not found (404)' }, { entryId: 'a1', error: 'Invalid API key (401)' }],
    });
    await user.click(within(footer()).getByRole('button', { name: 'Log 2 to Easy8' }));
    const rows = await screen.findAllByTestId('entry-row');
    expect(within(rows[0]).getByRole('alert')).toHaveTextContent('Issue not found (404)');
    expect(within(rows[1]).getByRole('alert')).toHaveTextContent('Invalid API key (401)');
    expect(screen.getByTestId('auth-banner')).toHaveTextContent('Invalid API key (401)');
    expect(window.timerAPI.showNotification).toHaveBeenCalledWith('Logging Failed', 'Failed to log 2 entries');
    await user.click(within(screen.getByTestId('auth-banner')).getByRole('button', { name: 'Open Settings' }));
    expect(onNavigate).toHaveBeenCalledWith('settings');
    expect(screen.queryByText(/entry logged|entries logged/)).toBeNull();
  });

  it('a row error clears on the next log attempt and on edit', async () => {
    const { user, logSelected } = await renderLog([makeEntry('pomodoro')]);
    vi.mocked(logSelected).mockResolvedValueOnce({ success: 0, failed: 1, errors: [{ entryId: 'pomodoro-1', error: 'API error: 500' }] });
    await user.click(within(footer()).getByRole('button', { name: 'Log 1 to Easy8' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('API error: 500');
    vi.mocked(logSelected).mockResolvedValueOnce({ success: 1, failed: 0, errors: [] });
    await user.click(within(footer()).getByRole('button', { name: 'Log 1 to Easy8' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    vi.mocked(logSelected).mockResolvedValueOnce({ success: 0, failed: 1, errors: [{ entryId: 'pomodoro-1', error: 'API error: 500' }] });
    await user.click(within(footer()).getByRole('button', { name: 'Log 1 to Easy8' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Billable' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('footer counts marked rows without a task as needing one', async () => {
    await renderLog([makeEntry('adhoc', { taskId: null })]);
    expect(footer()).toHaveTextContent('1 needs a task');
  });

  it('Select all / Unselect all calls toggleSelectAll', async () => {
    const { user, toggleSelectAll } = await renderLog([makeEntry('pomodoro', { markedToLog: false })]);
    await user.click(screen.getByRole('button', { name: 'Select all' }));
    expect(toggleSelectAll).toHaveBeenCalledTimes(1);
    useLogStore.setState({ entries: [makeEntry('pomodoro')] });
    expect(await screen.findByRole('button', { name: 'Unselect all' })).toBeInTheDocument();
  });

  it('Templates opens the manager and + Entry opens AddEntryModal', async () => {
    const { user } = await renderLog([makeEntry('pomodoro')]);
    await user.click(screen.getByRole('button', { name: 'Templates' }));
    expect(screen.getByTestId('template-modal')).toBeInTheDocument();
    await user.click(within(footer()).getByRole('button', { name: '+ Entry' }));
    expect(screen.getByTestId('add-entry-modal')).toBeInTheDocument();
  });

  it('merged row shows 2 sessions; toggling marks both sources; delete confirms with the count', async () => {
    const a = makeEntry('pomodoro', { id: 'p1', markedToLog: false });
    const b = makeEntry('pomodoro', { id: 'p2', markedToLog: false, startTime: `${FIXTURE_DATE}T10:00:00.000` });
    const { user, toggleLogMark, deleteEntry } = await renderLog([a, b]);
    await user.click(screen.getByRole('button', { name: 'Group by task' }));
    expect(screen.getByText('2 sessions')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Log this entry' }));
    expect(toggleLogMark).toHaveBeenCalledWith('p1');
    expect(toggleLogMark).toHaveBeenCalledWith('p2');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(confirm).toHaveBeenCalledWith('Delete all 2 sessions in this merge?\n\nThis cannot be undone.');
    await waitFor(() => expect(deleteEntry).toHaveBeenCalledTimes(2));
  });

  it('merged delete declined deletes nothing', async () => {
    const a = makeEntry('pomodoro', { id: 'p1' });
    const b = makeEntry('pomodoro', { id: 'p2' });
    const { user, deleteEntry } = await renderLog([a, b]);
    await user.click(screen.getByRole('button', { name: 'Group by task' }));
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deleteEntry).not.toHaveBeenCalled();
  });

  it('Assign task save on a proposal → acceptCalendarProposal(id, "123") then loadDay(date, true)', async () => {
    const { user, loadDay, updateEntry } = await renderLog([makeEntry('proposal')]);
    await user.click(screen.getByRole('button', { name: 'Assign task' }));
    await user.type(screen.getByPlaceholderText('Task ID'), '123');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(updateEntry).toHaveBeenCalledWith('proposal-1', expect.objectContaining({ title: 'KKS upsell call' }));
    await waitFor(() => expect(window.logAPI.acceptCalendarProposal).toHaveBeenCalledWith('proposal-1', '123'));
    await waitFor(() => expect(loadDay).toHaveBeenCalledWith(FIXTURE_DATE, true));
  });

  it('Accept / Dismiss on a proposal row go through the bridge and reload locally', async () => {
    const { user, loadDay } = await renderLog([makeEntry('proposal')]);
    await user.click(screen.getByRole('button', { name: 'Accept' }));
    expect(window.logAPI.acceptCalendarProposal).toHaveBeenCalledWith('proposal-1', undefined);
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(window.logAPI.dismissCalendarProposal).toHaveBeenCalledWith('proposal-1');
    await waitFor(() => expect(loadDay).toHaveBeenCalledWith(FIXTURE_DATE, true));
  });

  it('billable pill writes updateEntry(id, { billable: false })', async () => {
    const { user, updateEntry } = await renderLog([makeEntry('pomodoro')]);
    await user.click(screen.getByRole('button', { name: 'Billable' }));
    expect(updateEntry).toHaveBeenCalledWith('pomodoro-1', { billable: false });
  });

  it('onCalendarFeedUpdated callback invalidates the cache and reloads the day', async () => {
    let cb: (() => void) | undefined;
    window.timerAPI.onCalendarFeedUpdated = vi.fn((fn: () => void) => { cb = fn; return () => {}; });
    const { loadDay } = await renderLog([]);
    vi.mocked(loadDay).mockClear();
    await act(async () => { await cb?.(); });
    expect(invalidateCalendarCache).toHaveBeenCalled();
    expect(loadDay).toHaveBeenCalledWith(FIXTURE_DATE);
  });

  it('loads tomorrow\'s proposals for the next workday and shows the meeting load', async () => {
    window.logAPI.getCalendarProposals = vi.fn(async () => [
      { id: 'p', event_uid: 'u', title: 'Standup', start_at: '', end_at: '', duration_minutes: 90, date: '2026-09-28', accepted: 0, dismissed: 0, task_id: null, comment: null, logged: 0, billable: 1 },
    ]);
    await renderLog([]);
    await waitFor(() => expect(syncCalendarProposals).toHaveBeenCalledWith('2026-09-28'));
    expect(window.logAPI.getCalendarProposals).toHaveBeenCalledWith('2026-09-28');
    expect(screen.getByTestId('tomorrow-date')).toHaveTextContent('Mon 28 Sep');
    expect(await screen.findByText(/4h 30m/)).toBeInTheDocument();
  });

  it('shows Calendar unavailable when the tomorrow feed fails', async () => {
    vi.mocked(syncCalendarProposals).mockRejectedValueOnce(new Error('feed down'));
    await renderLog([]);
    expect(await screen.findByText('Calendar unavailable')).toBeInTheDocument();
  });

  it('End day opens the modal with the reflection draft and the next workday', async () => {
    const { user } = await renderLog([]);
    await user.type(screen.getByLabelText('One line on today'), 'Solid day');
    await user.click(screen.getByRole('button', { name: 'End day' }));
    const modal = screen.getByTestId('end-day-modal');
    expect(modal).toHaveAttribute('data-reflection', 'Solid day');
    expect(modal).toHaveAttribute('data-tomorrow', '2026-09-28');
  });

  it('locked day hides End day, shows Day ended and the saved reflection', async () => {
    window.dashboardAPI.isDayLocked = vi.fn(async () => true);
    window.dashboardAPI.getShutdownRitual = vi.fn(async () => ({
      date: FIXTURE_DATE, totalMinutes: 0, deepWorkMinutes: 0, tasksWorked: [], reflection: 'Saved line', notes: null, tomorrowIntentions: null, locked: true, createdAt: '',
    }));
    await renderLog([]);
    expect(await screen.findByText('Day ended')).toBeInTheDocument();
    expect(screen.getByTestId('saved-reflection')).toHaveTextContent('Saved line');
    expect(screen.queryByRole('button', { name: 'End day' })).toBeNull();
  });

  it('aside lists open today items from the lists store', async () => {
    useListsStore.setState({
      lists: [],
      items: [{ id: 'i1', list_id: 'l1', title: 'Carry me', task_id: '77', column: 'today', order: 0, completed: 0, archived: 0, completed_at: null, description: null, subtasks: '[]', billable: 1, created_at: '' }],
    });
    await renderLog([]);
    expect(within(screen.getByRole('complementary', { name: 'Tomorrow' })).getByText('Carry me')).toBeInTheDocument();
    useListsStore.setState({ lists: [], items: [] });
  });

  it('table rows never render a # before the task id', async () => {
    await renderLog([makeEntry('pomodoro'), makeEntry('calendar', { id: 'c1' })]);
    for (const el of screen.getAllByTestId('entry-task-id')) {
      expect(el.textContent).not.toContain('#');
    }
    expect(table()).toBeInTheDocument();
  });

  it('the main column scrolls as a whole; the entries section is unconstrained and its footer sticky', async () => {
    await renderLog([makeEntry('pomodoro')]);
    const main = screen.getByTestId('review-main');
    expect(main).toHaveClass('overflow-y-auto');
    expect(main).not.toHaveClass('overflow-hidden');
    expect(table()).not.toHaveClass('overflow-hidden', 'flex-1');
    expect(screen.getByTestId('entries-body')).not.toHaveClass('overflow-auto', 'overflow-y-auto');
    expect(footer()).toHaveClass('sticky', 'bottom-0');
  });
});

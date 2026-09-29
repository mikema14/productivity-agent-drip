import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Timer from './Timer';
import { makeTasks } from '../../test/fixtures';
import { setTimer, resetTimer } from '../../test/timerState';
import { useIntentionsStore } from '../../stores/intentionsStore';
import { useLogStore } from '../../stores/logStore';
import { useTimerStore } from '../../stores/timerStore';
import { useListsStore } from '../../stores/listsStore';
import type { PomodoroSession } from '../../types';
import { getCurrentDate } from '../../utils/time';

// Keep the real exports (DAY_TARGET_MINUTES / DAY_BAR_SEGMENTS feed the running card's readouts).
vi.mock('./TimerDayTimeline', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./TimerDayTimeline')>()),
  default: () => <div>TimelineStub</div>,
}));
vi.mock('../Lists/TimerTaskList', () => ({ default: () => <div>TaskListStub</div> }));

const today = getCurrentDate();

function makeSession(i: number, overrides: Partial<PomodoroSession> = {}): PomodoroSession {
  return {
    id: `s${i}`, start_at: `${today}T09:0${i}:00.000Z`, end_at: `${today}T09:3${i}:00.000Z`,
    duration_minutes: 25, task_id: '600001', source: 'pomodoro', comment: null,
    logged: 0, log_sent_at: null, server_entry_id: null, billable: 1, ...overrides,
  } as PomodoroSession;
}

async function renderTimer() {
  const nav = vi.fn();
  render(<Timer onNavigate={nav} />);
  // Let the mount effects (sessions, previous session, recent tasks, intentions) settle.
  await act(async () => { await Promise.resolve(); });
  return { nav, user: userEvent.setup() };
}

const key = (name: RegExp | string) => screen.getByRole('button', { name });
const queryKey = (name: RegExp | string) => screen.queryByRole('button', { name });

async function selectFirstTask(user: ReturnType<typeof userEvent.setup>) {
  const options = await screen.findAllByRole('option');
  await user.click(options[0]);
}

describe('Timer — ready states', () => {
  beforeEach(() => {
    window.logAPI.getRankedRecentTasks = vi.fn(async () => makeTasks(3));
    useIntentionsStore.setState({ intentions: new Map() });
  });
  afterEach(() => resetTimer());

  it('ready-empty: Begin Focus disabled, Kickoff enabled, picker visible, Set intention key, 44px continue slot', async () => {
    await renderTimer();
    expect(key(/begin focus/i)).toBeDisabled();
    expect(key(/kickoff 2m/i)).toBeEnabled();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(key(/set intention/i)).toBeInTheDocument();
    expect(screen.getByTestId('continue-slot')).toHaveClass('h-[44px]');
    expect(screen.queryByText(/continue previous/i)).toBeNull();
    expect(screen.getByTestId('now-pill')).toHaveTextContent('Ready');
    expect(screen.getByText('READY')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('25:00');
  });

  it('ready: digits show the selected duration, not the stale remainingSeconds', async () => {
    setTimer({ status: 'idle', remainingSeconds: 1500, totalDuration: 1500, durationMinutes: 15 });
    await renderTimer();
    expect(screen.getByRole('timer')).toHaveTextContent('15:00');
    expect(screen.getByRole('button', { name: '15' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('tick-ruler').querySelectorAll('[data-tick]')).toHaveLength(16);
  });

  it('ready-selected: Begin Focus enabled, billable switch, note input, listbox hidden, duration strip inside the card', async () => {
    const { user } = await renderTimer();
    await selectFirstTask(user);

    expect(key(/begin focus/i)).toBeEnabled();
    expect(screen.getByRole('switch')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Session note (optional)')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).toBeNull();
    const card = screen.getByRole('button', { name: /600001/ }).parentElement!;
    expect(within(card).getByRole('group', { name: 'Duration in minutes' })).toBeInTheDocument();
    expect(screen.getByText('Task number 1')).toBeInTheDocument();
  });

  it('Enter begins focus only when a task is selected, no field is focused and no modal is open', async () => {
    const { user } = await renderTimer();

    await user.keyboard('{Enter}');
    expect(window.timerAPI.startMainTimer).not.toHaveBeenCalled();

    await selectFirstTask(user);
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(window.timerAPI.startMainTimer).toHaveBeenCalledTimes(1));
    expect(window.timerAPI.startMainTimer).toHaveBeenCalledWith(1500, 'focus', 5, '600001', undefined);
  });

  it('Enter is ignored while the note input has focus or SetIntentionModal is open', async () => {
    const { user } = await renderTimer();
    await selectFirstTask(user);

    await user.click(screen.getByPlaceholderText('Session note (optional)'));
    await user.keyboard('{Enter}');
    expect(window.timerAPI.startMainTimer).not.toHaveBeenCalled();

    (document.activeElement as HTMLElement | null)?.blur();
    await user.click(key(/set intention/i));
    expect(screen.getByText("Today's intentions")).toBeInTheDocument();
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('{Enter}');
    expect(window.timerAPI.startMainTimer).not.toHaveBeenCalled();
  });

  it('Kickoff 2m with a selected task starts a 120 s kickoff on that task that rolls into the full session', async () => {
    const { user } = await renderTimer();
    await selectFirstTask(user);
    await user.click(key(/kickoff 2m/i));
    await waitFor(() => expect(window.timerAPI.startMainTimer).toHaveBeenCalledTimes(1));
    expect(window.timerAPI.startMainTimer).toHaveBeenCalledWith(120, 'focus', 5, '600001', 1500);
  });

  it('Kickoff 2m with no task resolves the task through the store (last session with a task)', async () => {
    window.timerAPI.getLastSessionWithTask = vi.fn(async () => makeSession(1, { task_id: '777' }));
    const { user } = await renderTimer();
    await user.click(key(/kickoff 2m/i));
    await waitFor(() => expect(window.timerAPI.startMainTimer).toHaveBeenCalledTimes(1));
    expect(window.timerAPI.startMainTimer).toHaveBeenCalledWith(120, 'focus', 5, '777', 1500);
  });

  it('shows the continue-previous CTA in the reserved slot when a previous session exists', async () => {
    window.timerAPI.getLastSessionWithTask = vi.fn(async () => makeSession(1, { comment: 'Yesterday work' }));
    await renderTimer();
    const slot = screen.getByTestId('continue-slot');
    expect(await within(slot).findByText('Yesterday work')).toBeInTheDocument();
    expect(within(slot).getByText('600001')).toBeInTheDocument();
    expect(within(slot).queryByText('#600001')).toBeNull();
  });

  it('consumes a pendingSelection on mount: task selected, note set, selection cleared', async () => {
    window.logAPI.getCachedTask = vi.fn(async () => makeTasks(1)[0]);
    setTimer({ pendingSelection: { taskId: '600001', title: 'Do X' } });
    await renderTimer();
    expect(await screen.findByText('Task number 1')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Session note (optional)')).toHaveValue('Do X');
    expect(useTimerStore.getState().pendingSelection).toBeNull();
  });

  it('clearSelection() from the store drops the picked task (the kickoff takeover\'s Stop / Finish)', async () => {
    const { user } = await renderTimer();
    await selectFirstTask(user);
    expect(key(/begin focus/i)).toBeEnabled();
    act(() => { useTimerStore.getState().clearSelection(); });
    expect(key(/begin focus/i)).toBeDisabled();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('a pendingSelection is not undone by the mount value of selectionResetToken', async () => {
    window.logAPI.getCachedTask = vi.fn(async () => makeTasks(1)[0]);
    setTimer({ pendingSelection: { taskId: '600001', title: 'Do X' }, selectionResetToken: 3 });
    await renderTimer();
    expect(await screen.findByText('Task number 1')).toBeInTheDocument();
    expect(key(/begin focus/i)).toBeEnabled();
  });

  it('leaves a pendingSelection untouched while a session is running', async () => {
    setTimer({ status: 'focus', sessionStartTime: new Date(), totalDuration: 1500, remainingSeconds: 1200, currentTaskId: '600002', pendingSelection: { taskId: '600001', title: 'Do X' } });
    await renderTimer();
    expect(window.logAPI.getCachedTask).not.toHaveBeenCalledWith('600001');
    expect(useTimerStore.getState().pendingSelection).toEqual({ taskId: '600001', title: 'Do X' });
  });

  it('IntentionRow shows the intention with EDIT, which opens SetIntentionModal', async () => {
    useIntentionsStore.setState({ intentions: new Map([[today, ['Ship the rail']]]) });
    window.dashboardAPI.getDailyIntentions = vi.fn(async () => ({ date: today, intentions: ['Ship the rail'] }));
    const { user } = await renderTimer();
    expect(screen.getByText('Ship the rail')).toBeInTheDocument();
    expect(queryKey(/set intention/i)).toBeNull();
    await user.click(key(/edit/i));
    expect(screen.getByText("Today's intentions")).toBeInTheDocument();
  });

  it('aside footer counts unlogged work and REVIEW DAY opens Review for today', async () => {
    window.timerAPI.getSessions = vi.fn(async () => [
      makeSession(1), makeSession(2), makeSession(3, { logged: 1 }), makeSession(4, { source: 'break' }),
    ]);
    const loadDay = vi.fn(async () => undefined);
    // R1: the link must select today even when Review was left on another day
    useLogStore.setState({ loadDay, selectedDate: '2020-01-01' });
    const { user, nav } = await renderTimer();
    expect(await screen.findByText('2 unlogged')).toBeInTheDocument();

    await user.click(key(/review day/i));
    expect(useLogStore.getState().selectedDate).toBe(today);
    expect(loadDay).toHaveBeenCalledWith(today);
    expect(nav).toHaveBeenCalledWith('daily-log');
  });

  it('aside toggles between the timeline and the task list', async () => {
    const { user } = await renderTimer();
    expect(screen.getByText('TimelineStub')).toBeInTheDocument();
    await user.click(key(/^tasks$/i));
    expect(screen.getByText('TaskListStub')).toBeInTheDocument();
    expect(screen.queryByText('TimelineStub')).toBeNull();
    await user.click(key(/^timeline$/i));
    expect(screen.getByText('TimelineStub')).toBeInTheDocument();
  });

  it('Boundary dialog "Change Settings" navigates to Settings', async () => {
    window.timerAPI.getSettings = vi.fn(async (k: string) =>
      k === 'enableBoundaryCheck' ? 'true' : k === 'workdayEndTime' ? '00:00' : null
    );
    const { user, nav } = await renderTimer();
    await selectFirstTask(user);
    await user.click(key(/begin focus/i));
    expect(await screen.findByText('Starting Work Late?')).toBeInTheDocument();
    await user.click(key('Change Settings'));
    expect(nav).toHaveBeenCalledWith('settings');
    expect(screen.queryByText('Starting Work Late?')).toBeNull();
    expect(window.timerAPI.startMainTimer).not.toHaveBeenCalled();
  });
});

describe('Timer — active states', () => {
  beforeEach(() => {
    useIntentionsStore.setState({ intentions: new Map() });
  });
  afterEach(() => resetTimer());

  it('running: Pause / Finish / Cancel / +5 min present, Begin Focus absent, header FOCUS + id + ENDS, pill + digits', async () => {
    const start = new Date(2026, 8, 25, 11, 40, 0);
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: start, totalDuration: 1500, remainingSeconds: 1200, currentTaskId: '600001', intervalId: 1 });
    await renderTimer();
    expect(key(/pause/i)).toBeInTheDocument();
    expect(key(/finish/i)).toBeInTheDocument();
    expect(key(/cancel/i)).toBeInTheDocument();
    expect(key(/\+5 min/i)).toBeInTheDocument();
    expect(queryKey(/begin focus/i)).toBeNull();
    expect(queryKey(/kickoff/i)).toBeNull();
    const header = screen.getByTestId('focus-header');
    expect(header).toHaveTextContent(/^Focus600001Ends 12:05$/);
    expect(within(header).getByText('Focus')).toHaveTextContent(/^Focus$/);
    expect(screen.getByTestId('active-task-id')).toHaveTextContent('600001');
    expect(screen.queryByText('#600001')).toBeNull();
    expect(screen.getByTestId('now-pill')).toHaveTextContent('Focusing');
    expect(screen.getByRole('timer')).toHaveTextContent('20:00');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('running: calm block — no start time, no intention row or 01 Focus header, title from the cache', async () => {
    window.logAPI.getCachedTask = vi.fn(async () => makeTasks(1)[0]);
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(2026, 8, 25, 22, 22, 0), totalDuration: 900, remainingSeconds: 800, currentTaskId: '600001', intervalId: 1, sessionCount: 0 });
    await renderTimer();
    expect(screen.getByRole('region', { name: 'Focus' })).toHaveAttribute('data-layout', 'calm');
    expect(screen.queryByTestId('countdown-label')).toBeNull();
    expect(screen.queryByText(/22:22/)).toBeNull();
    expect(screen.queryByText('01 Focus')).toBeNull();
    expect(queryKey(/set intention/i)).toBeNull();
    expect(screen.queryByTestId('continue-slot')).toBeNull();
    expect(screen.getByTestId('focus-header')).toHaveTextContent('Ends 22:37');
    expect(await screen.findByTestId('active-task-title')).toHaveTextContent('Task number 1');
  });

  it('running: readouts count today with the running session — focus / 6h bar, session number + squares, this task', async () => {
    window.timerAPI.getSessions = vi.fn(async () => [
      makeSession(0, { duration_minutes: 25 }),
      makeSession(1, { duration_minutes: 50 }),
      makeSession(2, { duration_minutes: 11, task_id: '662962' }),
      makeSession(3, { duration_minutes: 5, source: 'break', task_id: null }),
    ]);
    // 10 minutes into the running session on 600001
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(Date.now() - 600_000), totalDuration: 1500, remainingSeconds: 900, currentTaskId: '600001', intervalId: 1 });
    await renderTimer();
    const readouts = await screen.findByTestId('focus-readouts');
    await waitFor(() => expect(within(readouts).getByText(/^1h 36m/)).toBeInTheDocument());
    const bar = within(readouts).getByTestId('day-bar');
    expect(bar).toHaveAttribute('aria-label', '1 hour 36 minutes of 6 hours');
    expect(bar.querySelectorAll('[data-filled]')).toHaveLength(3);
    expect(within(readouts).getByTestId('session-number')).toHaveTextContent('04');
    const squares = within(readouts).getAllByTestId('session-square');
    expect(squares).toHaveLength(4);
    expect(squares[3]).toHaveAttribute('data-current');
    expect(squares.filter(q => q.hasAttribute('data-current'))).toHaveLength(1);
    expect(within(readouts).getByTestId('task-readout')).toHaveTextContent('1h 25m · 3 sessions');
  });

  it('running with no task: no ON THIS TASK readout', async () => {
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(), totalDuration: 1500, remainingSeconds: 1500, currentTaskId: null, intervalId: 1 });
    await renderTimer();
    expect(screen.getByTestId('session-number')).toHaveTextContent('01');
    expect(screen.queryByTestId('task-readout')).toBeNull();
  });

  it('running: the INTENT line edits the session note in place — Enter saves, Escape reverts, empty shows the placeholder', async () => {
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(), totalDuration: 1500, remainingSeconds: 1200, currentTaskId: '600001', intention: '', intervalId: 1 });
    const { user } = await renderTimer();
    const line = screen.getByTestId('intent-line');
    expect(line).toHaveTextContent('Add an intent for this session');
    await user.click(line);
    await user.type(screen.getByRole('textbox', { name: 'Session intent' }), 'error preview{Enter}');
    expect(useTimerStore.getState().intention).toBe('error preview');
    expect(screen.getByTestId('intent-line')).toHaveTextContent('error preview');

    await user.click(screen.getByTestId('intent-line'));
    const input = screen.getByRole('textbox', { name: 'Session intent' });
    await user.clear(input);
    await user.type(input, 'something else{Escape}');
    expect(useTimerStore.getState().intention).toBe('error preview');
    expect(screen.queryByRole('textbox', { name: 'Session intent' })).toBeNull();
  });

  it('running: key set and variants — Pause light, Finish outline, +5 min text, Cancel text-danger', async () => {
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(), totalDuration: 1500, remainingSeconds: 1200, intervalId: 1 });
    await renderTimer();
    expect(key(/^pause$/i)).toHaveAttribute('data-variant', 'light');
    expect(key(/^finish$/i)).toHaveAttribute('data-variant', 'outline');
    expect(key(/\+5 min/i)).toHaveAttribute('data-variant', 'text');
    expect(key(/^cancel$/i)).toHaveAttribute('data-variant', 'text-danger');
    expect(queryKey(/resume/i)).toBeNull();
  });

  it('running: the ruler is scaled to the session and the RAF effect writes --progress on it', async () => {
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(Date.now() - 600_000), totalDuration: 1500, remainingSeconds: 900, intervalId: 1 });
    await renderTimer();
    const ruler = screen.getByTestId('tick-ruler');
    expect(ruler.querySelectorAll('[data-tick]')).toHaveLength(26);
    expect(ruler.querySelectorAll('[data-lit]')).toHaveLength(10);
    expect(ruler).not.toHaveClass('opacity-50');
    await waitFor(() => {
      const progress = parseFloat(ruler.style.getPropertyValue('--progress'));
      expect(progress).toBeGreaterThan(0.39);
      expect(progress).toBeLessThan(0.41);
    });
  });

  it('running: Finish calls finishEarly; a later idle render has no task selected', async () => {
    const finishEarly = vi.fn(async () => undefined);
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(), totalDuration: 1500, remainingSeconds: 1200, currentTaskId: '600001', intervalId: 1, finishEarly });
    const { user } = await renderTimer();
    await user.click(key(/^finish$/i));
    expect(finishEarly).toHaveBeenCalledTimes(1);
    setTimer({ status: 'idle', sessionStartTime: null, intervalId: null, currentTaskId: null });
    expect(await screen.findByRole('button', { name: /begin focus/i })).toBeDisabled();
  });

  it('running with no task: the intention stands in for the title; with neither, "No task attached"', async () => {
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(), totalDuration: 1500, remainingSeconds: 1200, currentTaskId: null, intention: 'Write the spec', intervalId: 1 });
    await renderTimer();
    expect(screen.getByText('Write the spec')).toBeInTheDocument();
    expect(screen.queryByTestId('active-task-id')).toBeNull();
    expect(screen.queryByTestId('active-task-title')).toBeNull();
    setTimer({ intention: '' });
    expect(await screen.findByText('No task attached')).toBeInTheDocument();
  });

  it('+5 min extends the main timer by 300 s', async () => {
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(), totalDuration: 1500, remainingSeconds: 1200, intervalId: 1 });
    const { user } = await renderTimer();
    await user.click(key(/\+5 min/i));
    expect(window.timerAPI.extendMainTimer).toHaveBeenCalledWith(300);
  });

  it('paused: Resume (light) present, Pause and +5 min absent, header PAUSED + ENDS, digits and ruler dimmed', async () => {
    setTimer({ status: 'focus', isPaused: true, sessionStartTime: new Date(2026, 8, 25, 11, 40), totalDuration: 1500, remainingSeconds: 900, currentTaskId: '600001', intervalId: 1 });
    await renderTimer();
    expect(key(/resume/i)).toHaveAttribute('data-variant', 'light');
    expect(queryKey(/pause/i)).toBeNull();
    expect(queryKey(/\+5 min/i)).toBeNull();
    expect(key(/^finish$/i)).toBeInTheDocument();
    expect(key(/^cancel$/i)).toBeInTheDocument();
    const header = screen.getByTestId('focus-header');
    expect(header).toHaveTextContent(/^Paused600001Ends 12:05$/);
    expect(screen.getByRole('timer')).toHaveClass('text-txt-secondary');
    expect(screen.getByTestId('tick-ruler')).toHaveClass('opacity-50');
    expect(screen.getByRole('region', { name: 'Focus' })).toHaveClass('border-t-drip-border');
    expect(screen.getByTestId('now-pill')).toHaveTextContent('Paused');
  });

  it('+5 min moves ENDS by five minutes', async () => {
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(2026, 8, 25, 11, 40), totalDuration: 1500, remainingSeconds: 1200, intervalId: 1 });
    await renderTimer();
    expect(screen.getByTestId('focus-header')).toHaveTextContent('Ends 12:05');
    setTimer({ totalDuration: 1800, remainingSeconds: 1500 });
    await waitFor(() => expect(screen.getByTestId('focus-header')).toHaveTextContent('Ends 12:10'));
  });

  it('Cancel after 400 s asks for confirmation; after 60 s stops immediately', async () => {
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(), totalDuration: 1500, remainingSeconds: 1100, intervalId: 1 });
    const { user } = await renderTimer();
    await user.click(key(/^cancel$/i));
    expect(screen.getByText('Cancel this session?')).toBeInTheDocument();
    expect(window.timerAPI.stopMainTimer).not.toHaveBeenCalled();
    await user.click(key('Keep focusing'));
    expect(screen.queryByText('Cancel this session?')).toBeNull();

    setTimer({ remainingSeconds: 1440 });
    await user.click(key(/^cancel$/i));
    expect(screen.queryByText('Cancel this session?')).toBeNull();
    await waitFor(() => expect(window.timerAPI.stopMainTimer).toHaveBeenCalledTimes(1));
  });

  it('break, nothing picked: Begin Focus disabled next to Skip Break, duration strip, picker below; no Kickoff', async () => {
    setTimer({ status: 'break', isPaused: false, sessionStartTime: new Date(), totalDuration: 300, remainingSeconds: 200, intervalId: 1, sessionCount: 2 });
    await renderTimer();
    expect(key(/skip break/i)).toBeInTheDocument();
    expect(key(/begin focus/i)).toBeDisabled();
    expect(key(/begin focus/i)).toHaveAttribute('title', 'Pick a task first');
    expect(key(/^pause$/i)).toBeInTheDocument();
    expect(queryKey(/kickoff/i)).toBeNull();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(key(/set intention/i)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Duration in minutes' })).toBeInTheDocument();
    expect(screen.getByTestId('now-pill')).toHaveTextContent('Break');
    expect(screen.getByText(/^BREAK ·/)).toBeInTheDocument();
    expect(screen.getByText(/done/i)).toHaveTextContent('2/8 done');
  });

  it('break: picking a task shows the card with duration, note, billable and an enabled Begin Focus', async () => {
    window.logAPI.getRankedRecentTasks = vi.fn(async () => makeTasks(3));
    setTimer({ status: 'break', isPaused: false, sessionStartTime: new Date(), totalDuration: 300, remainingSeconds: 200, intervalId: 1 });
    const { user } = await renderTimer();
    await selectFirstTask(user);
    expect(screen.getByText('Task number 1')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Session note (optional)')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Duration in minutes' })).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(key(/skip break/i)).toBeInTheDocument();
    expect(key(/begin focus/i)).toBeEnabled();
    expect(queryKey(/kickoff/i)).toBeNull();
  });

  it('break: Begin Focus saves the break so far (≥ 1 min) and starts the picked task at the chosen length', async () => {
    window.logAPI.getRankedRecentTasks = vi.fn(async () => makeTasks(3));
    window.timerAPI.saveSession = vi.fn(async () => 'break-row');
    window.timerAPI.startMainTimer = vi.fn(async () => ({ raycastFocus: false }));
    setTimer({ status: 'break', isPaused: false, sessionStartTime: new Date(Date.now() - 120_000), totalDuration: 300, remainingSeconds: 180, intervalId: 1 });
    const { user } = await renderTimer();
    await selectFirstTask(user);
    await user.click(screen.getByRole('button', { name: '50' }));
    // Picking a length mid-break leaves the break countdown alone.
    expect(useTimerStore.getState().remainingSeconds).toBe(180);
    await user.click(key(/begin focus/i));
    await waitFor(() => expect(window.timerAPI.startMainTimer).toHaveBeenCalled());
    expect(window.timerAPI.saveSession).toHaveBeenCalledWith(expect.objectContaining({ source: 'break', duration_minutes: 2, task_id: null }));
    const [secs, type, , taskId] = vi.mocked(window.timerAPI.startMainTimer).mock.calls[0];
    expect([secs, type, taskId]).toEqual([50 * 60, 'focus', makeTasks(1)[0].task_id]);
    const saveOrder = vi.mocked(window.timerAPI.saveSession).mock.invocationCallOrder[0];
    expect(saveOrder).toBeLessThan(vi.mocked(window.timerAPI.startMainTimer).mock.invocationCallOrder[0]);
  });

  it('break: Pause / Resume drive the main timer and the label says paused', async () => {
    window.timerAPI.pauseMainTimer = vi.fn(async () => undefined);
    window.timerAPI.resumeMainTimer = vi.fn(async () => undefined);
    setTimer({ status: 'break', isPaused: false, sessionStartTime: new Date(), totalDuration: 300, remainingSeconds: 200, intervalId: 1 });
    const { user } = await renderTimer();
    await user.click(key(/^pause$/i));
    expect(window.timerAPI.pauseMainTimer).toHaveBeenCalled();
    expect(await screen.findByText('BREAK · PAUSED')).toBeInTheDocument();
    await user.click(key(/^resume$/i));
    expect(window.timerAPI.resumeMainTimer).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: /^pause$/i })).toBeInTheDocument();
  });

  it('ready after a finished focus: Start break Nm starts the earned break; without one there is no key', async () => {
    window.timerAPI.startMainTimer = vi.fn(async () => ({ raycastFocus: false }));
    setTimer({ status: 'idle', pendingBreakMinutes: 5, sessionCount: 1, durationMinutes: 25 });
    const { user } = await renderTimer();
    // The due break is the prompt: header pill, label and the primary key.
    expect(screen.getByTestId('now-pill')).toHaveTextContent('Break due');
    expect(screen.getByText('SESSION DONE')).toBeInTheDocument();
    expect(screen.getByText(/Session done\. Take a 5-minute break/)).toBeInTheDocument();
    expect(key(/start break 5m/i)).toHaveAttribute('data-variant', 'amber');
    expect(key(/begin focus/i)).toHaveAttribute('data-variant', 'outline');
    await user.click(key(/start break 5m/i));
    await waitFor(() => expect(window.timerAPI.startMainTimer).toHaveBeenCalledWith(300, 'break'));
    expect(useTimerStore.getState().status).toBe('break');
    expect(useTimerStore.getState().pendingBreakMinutes).toBeNull();
  });

  it('ready with no finished focus: no Start break key', async () => {
    setTimer({ status: 'idle', pendingBreakMinutes: null });
    await renderTimer();
    expect(queryKey(/start break/i)).toBeNull();
    expect(key(/begin focus/i)).toHaveAttribute('data-variant', 'amber');
    expect(screen.getByTestId('now-pill')).toHaveTextContent('Ready');
  });

  it('break under a minute: Enter starts the focus and saves no break row', async () => {
    window.logAPI.getRankedRecentTasks = vi.fn(async () => makeTasks(3));
    window.timerAPI.saveSession = vi.fn(async () => 'break-row');
    window.timerAPI.startMainTimer = vi.fn(async () => ({ raycastFocus: false }));
    setTimer({ status: 'break', isPaused: false, sessionStartTime: new Date(Date.now() - 20_000), totalDuration: 300, remainingSeconds: 280, intervalId: 1 });
    const { user } = await renderTimer();
    await selectFirstTask(user);
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(window.timerAPI.startMainTimer).toHaveBeenCalledWith(25 * 60, 'focus', expect.anything(), makeTasks(1)[0].task_id, undefined));
    expect(window.timerAPI.saveSession).not.toHaveBeenCalled();
  });

  it('break: `/` focuses the task search', async () => {
    setTimer({ status: 'break', isPaused: false, sessionStartTime: new Date(), totalDuration: 300, remainingSeconds: 200, intervalId: 1 });
    const { user } = await renderTimer();
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('/');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByPlaceholderText('Search task ID or title…')));
  });

  it('break with no previous session: no reserved continue slot (no layout drop vs running)', async () => {
    window.timerAPI.getLastSessionWithTask = vi.fn(async () => null);
    setTimer({ status: 'break', isPaused: false, sessionStartTime: new Date(), totalDuration: 300, remainingSeconds: 200, intervalId: 1 });
    await renderTimer();
    expect(screen.queryByTestId('continue-slot')).toBeNull();
    expect(screen.queryByText(/continue previous/i)).toBeNull();
  });

  it('break with a previous session: the continue CTA still renders (Q6)', async () => {
    window.timerAPI.getLastSessionWithTask = vi.fn(async () => makeSession(1, { comment: 'Yesterday work' }));
    setTimer({ status: 'break', isPaused: false, sessionStartTime: new Date(), totalDuration: 300, remainingSeconds: 200, intervalId: 1 });
    await renderTimer();
    expect(await screen.findByText('Yesterday work')).toBeInTheDocument();
    expect(screen.getByText(/continue previous/i)).toBeInTheDocument();
  });

  it('running: no continue slot', async () => {
    window.timerAPI.getLastSessionWithTask = vi.fn(async () => makeSession(1, { comment: 'Yesterday work' }));
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(), totalDuration: 1500, remainingSeconds: 1200, intervalId: 1 });
    await renderTimer();
    expect(screen.queryByTestId('continue-slot')).toBeNull();
    expect(screen.queryByText('Yesterday work')).toBeNull();
  });

  it('kickoff warmup: header reads KICKOFF · ROLLS INTO 25M (no ENDS), the pill says Kickoff, +5 min present', async () => {
    setTimer({ status: 'focus', isPaused: false, kickoff: 'warmup', sessionStartTime: new Date(), totalDuration: 120, remainingSeconds: 100, currentTaskId: '600001', intervalId: 1, durationMinutes: 25 });
    await renderTimer();
    const header = screen.getByTestId('focus-header');
    expect(header).toHaveTextContent(/^Kickoff600001Rolls into 25m$/);
    expect(header).not.toHaveTextContent(/Ends/);
    expect(screen.getByTestId('now-pill')).toHaveTextContent('Kickoff');
    expect(key(/\+5 min/i)).toBeInTheDocument();
    expect(key(/^pause$/i)).toHaveAttribute('data-variant', 'light');
  });

  it('kickoff: calm layout with a 2-minute ruler, the running readouts and no /8 counter', async () => {
    setTimer({ status: 'focus', isPaused: false, kickoff: 'warmup', sessionStartTime: new Date(), totalDuration: 120, remainingSeconds: 100, intervalId: 1, durationMinutes: 25, sessionCount: 0 });
    await renderTimer();
    expect(screen.getByRole('region', { name: 'Focus' })).toHaveAttribute('data-layout', 'calm');
    expect(screen.queryByTestId('countdown-label')).toBeNull();
    expect(screen.queryByText('/8', { exact: false })).toBeNull();
    expect(screen.getByTestId('session-number')).toHaveTextContent('01');
    expect(screen.getAllByTestId('session-square')).toHaveLength(1);
    const labels = Array.from(screen.getByTestId('tick-ruler').querySelectorAll('[data-label]')).map(l => l.textContent);
    expect(labels).toEqual(['00', '01', '02']);
  });

  it('running with an intention: the daily intention row is hidden while the card runs (Q16)', async () => {
    useIntentionsStore.setState({ intentions: new Map([[today, ['Ship the rail']]]) });
    window.dashboardAPI.getDailyIntentions = vi.fn(async () => ({ date: today, intentions: ['Ship the rail'] }));
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(), totalDuration: 1500, remainingSeconds: 1200, intervalId: 1 });
    await renderTimer();
    expect(screen.queryByRole('group', { name: "Today's intention: Ship the rail" })).toBeNull();
    expect(queryKey(/^edit$/i)).toBeNull();
  });

  it('Set intention → type → Done saves it for the local day and the row shows it', async () => {
    window.dashboardAPI.setDailyIntentions = vi.fn(async () => undefined);
    const { user } = await renderTimer();
    await user.click(key(/set intention/i));
    await user.type(screen.getByPlaceholderText(/what will you focus on today/i), 'Ship GDI scope');
    await user.click(key(/^done$/i));
    expect(window.dashboardAPI.setDailyIntentions).toHaveBeenCalledWith(today, ['Ship GDI scope']);
    expect(screen.queryByText("Today's intentions")).toBeNull();
    expect(screen.getByRole('group', { name: "Today's intention: Ship GDI scope" })).toBeInTheDocument();
    expect(key(/^edit$/i)).toBeInTheDocument();
  });

  it('paused: no SET INTENTION key either; the card keeps its INTENT line (Q16)', async () => {
    setTimer({ status: 'focus', isPaused: true, sessionStartTime: new Date(), totalDuration: 1500, remainingSeconds: 1200, intervalId: 1 });
    await renderTimer();
    expect(queryKey(/set intention/i)).toBeNull();
    expect(screen.getByTestId('intent-line')).toBeInTheDocument();
  });

  it('break with an intention: the row shows it with EDIT, which opens the modal', async () => {
    useIntentionsStore.setState({ intentions: new Map([[today, ['Ship the rail']]]) });
    window.dashboardAPI.getDailyIntentions = vi.fn(async () => ({ date: today, intentions: ['Ship the rail'] }));
    setTimer({ status: 'break', isPaused: false, sessionStartTime: new Date(), totalDuration: 300, remainingSeconds: 200, intervalId: 1 });
    const { user } = await renderTimer();
    expect(screen.getByText('Ship the rail')).toBeInTheDocument();
    await user.click(key(/^edit$/i));
    expect(screen.getByText("Today's intentions")).toBeInTheDocument();
  });

  it('ready and break keep the split layout with the session counter', async () => {
    setTimer({ status: 'break', isPaused: false, sessionStartTime: new Date(), totalDuration: 300, remainingSeconds: 200, intervalId: 1, sessionCount: 2 });
    await renderTimer();
    expect(screen.getByRole('region', { name: 'Focus' })).toHaveAttribute('data-layout', 'split');
    expect(screen.getAllByTestId('session-square')).toHaveLength(8);
    expect(screen.queryByTestId('focus-header')).toBeNull();
    setTimer({ status: 'idle', sessionStartTime: null, intervalId: null });
    await waitFor(() => expect(screen.getByTestId('countdown-label')).toHaveTextContent('READY'));
    expect(screen.getByRole('region', { name: 'Focus' })).toHaveAttribute('data-layout', 'split');
    expect(screen.getByText(/^Session/)).toHaveTextContent('Session 3/8');
  });
});

describe('Timer — Planned picker', () => {
  const planList = { id: 'l1', name: 'GDI Corporation', color: '#22c55e', icon_path: null, task_id: null, order: 0, archived: 0, billable: 1, created_at: '' };
  const planItem = (id: string, overrides: Record<string, unknown>) => ({
    id, list_id: 'l1', title: `Item ${id}`, task_id: null, column: 'today', order: 0, completed: 0, archived: 0,
    completed_at: null, description: null, subtasks: '[]', billable: 1, created_at: '', ...overrides,
  });

  beforeEach(() => {
    localStorage.removeItem('now_pickerSource');
    window.logAPI.getRankedRecentTasks = vi.fn(async () => makeTasks(3));
    window.logAPI.getCachedTask = vi.fn(async () => null);
    useIntentionsStore.setState({ intentions: new Map() });
    useListsStore.setState({
      lists: [planList] as never,
      items: [planItem('p1', { task_id: '662962', title: 'Scope finalasing' }), planItem('p2', { title: 'Share skills', column: 'this_week' })] as never,
    });
  });
  afterEach(() => {
    resetTimer();
    useListsStore.setState({ lists: [], items: [] });
  });

  it('break: picking a planned task selects it, takes its title as the note and enables Begin Focus', async () => {
    setTimer({ status: 'break', isPaused: false, sessionStartTime: new Date(), totalDuration: 300, remainingSeconds: 200, intervalId: 1 });
    const { user } = await renderTimer();
    expect(screen.getByRole('button', { name: 'Planned' })).toHaveAttribute('aria-pressed', 'true');
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(2);
    await user.click(options[0]);
    expect(await screen.findByDisplayValue('Scope finalasing')).toBeInTheDocument();
    expect(useTimerStore.getState().intention).toBe('Scope finalasing');
    expect(key(/begin focus/i)).toBeEnabled();
  });

  it('an item with no task only sets the note and keeps the picker open', async () => {
    const { user } = await renderTimer();
    const options = await screen.findAllByRole('option');
    await user.click(options[1]);
    expect(useTimerStore.getState().intention).toBe('Share skills');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(key(/begin focus/i)).toBeDisabled();
  });
});

describe('Timer — Up next (running)', () => {
  const planList = { id: 'l1', name: 'GDI Corporation', color: '#22c55e', icon_path: null, task_id: null, order: 0, archived: 0, billable: 1, created_at: '' };
  const planItem = (id: string, order: number, overrides: Record<string, unknown>) => ({
    id, list_id: 'l1', title: `Item ${id}`, task_id: null, column: 'today', order, completed: 0, archived: 0,
    completed_at: null, description: null, subtasks: '[]', billable: 1, created_at: '', ...overrides,
  });

  beforeEach(() => {
    useIntentionsStore.setState({ intentions: new Map() });
    useListsStore.setState({
      lists: [planList] as never,
      items: [
        planItem('p1', 0, { task_id: '667776', title: 'ER to Raynet integration' }),
        planItem('p2', 1, { task_id: '689742', title: 'Automatizovať dokumentáciu' }),
        planItem('p3', 2, { title: 'Share skills' }),
        planItem('p4', 3, { task_id: '645001', title: 'Next level' }),
        planItem('p5', 0, { task_id: '700000', title: 'Week item', column: 'this_week' }),
      ] as never,
    });
    window.timerAPI.getSessions = vi.fn(async () => [makeSession(0, { task_id: '689742', duration_minutes: 75 })]);
  });
  afterEach(() => {
    resetTimer();
    useListsStore.setState({ lists: [], items: [] });
  });

  it('lists two Today rows without the running task, keeps Today positions, tracked minutes, id-less row disabled', async () => {
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(), totalDuration: 1500, remainingSeconds: 1500, currentTaskId: '667776', intervalId: 1 });
    await renderTimer();
    const section = screen.getByRole('region', { name: 'Up next' });
    const rows = await within(section).findAllByTestId('up-next-row');
    expect(rows).toHaveLength(2);
    await waitFor(() => expect(rows[0]).toHaveTextContent(/^02689742Automatizovať dokumentáciu1h 15m$/));
    expect(rows[1]).toHaveTextContent(/^03Share skills$/);
    expect(rows[1]).toBeDisabled();
    expect(rows[1]).toHaveAttribute('title', 'No Easy8 task — set one in Plan');
    expect(within(section).queryByText('Next level')).toBeNull();
  });

  it('All today → opens Plan; Up next is absent in ready', async () => {
    setTimer({ status: 'focus', isPaused: true, sessionStartTime: new Date(), totalDuration: 1500, remainingSeconds: 1500, currentTaskId: '667776', intervalId: 1 });
    const { nav, user } = await renderTimer();
    await user.click(key(/all today/i));
    expect(nav).toHaveBeenCalledWith('all-lists');
    setTimer({ status: 'idle', isPaused: false, sessionStartTime: null, intervalId: null, currentTaskId: null });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Up next' })).toBeNull());
  });

  it('clicking a row finishes the running session, then starts focus on that task with its title as the note (Q17)', async () => {
    const calls: string[] = [];
    const finishEarly = vi.fn(async () => { calls.push('finish'); });
    const startFocus = vi.fn(async () => { calls.push(`start:${useTimerStore.getState().intention}`); });
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(), totalDuration: 1500, remainingSeconds: 1500, currentTaskId: '667776', intervalId: 1, finishEarly, startFocus });
    const { user } = await renderTimer();
    const rows = await screen.findAllByTestId('up-next-row');
    await user.click(rows[0]);
    await waitFor(() => expect(startFocus).toHaveBeenCalledWith('689742'));
    expect(calls).toEqual(['finish', 'start:Automatizovať dokumentáciu']);
  });

  it('nothing else on Today: the header stays with a quiet line', async () => {
    useListsStore.setState({ items: [planItem('p1', 0, { task_id: '667776', title: 'Only one' })] as never });
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(), totalDuration: 1500, remainingSeconds: 1500, currentTaskId: '667776', intervalId: 1 });
    await renderTimer();
    expect(screen.getByText('Nothing else on Today')).toBeInTheDocument();
    expect(screen.queryAllByTestId('up-next-row')).toHaveLength(0);
  });
});

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Timer from './Timer';
import { makeTasks } from '../../test/fixtures';
import { setTimer, resetTimer } from '../../test/timerState';
import { useIntentionsStore } from '../../stores/intentionsStore';
import { useLogStore } from '../../stores/logStore';
import { useTimerStore } from '../../stores/timerStore';
import type { PomodoroSession } from '../../types';

vi.mock('./TimerDayTimeline', () => ({ default: () => <div>TimelineStub</div> }));
vi.mock('../Lists/TimerTaskList', () => ({ default: () => <div>TaskListStub</div> }));

const today = new Date().toISOString().split('T')[0];

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

  it('running: Pause / Finish / Cancel / +5 min present, Begin Focus absent, window + pill + digits', async () => {
    const start = new Date(2026, 8, 25, 11, 40, 0);
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: start, totalDuration: 1500, remainingSeconds: 1200, currentTaskId: '600001', intervalId: 1 });
    await renderTimer();
    expect(key(/pause/i)).toBeInTheDocument();
    expect(key(/finish/i)).toBeInTheDocument();
    expect(key(/cancel/i)).toBeInTheDocument();
    expect(key(/\+5 min/i)).toBeInTheDocument();
    expect(queryKey(/begin focus/i)).toBeNull();
    expect(queryKey(/kickoff/i)).toBeNull();
    expect(screen.getByText('FOCUS · 11:40 → 12:05')).toBeInTheDocument();
    expect(screen.getByTestId('now-pill')).toHaveTextContent('Focusing');
    expect(screen.getByRole('timer')).toHaveTextContent('20:00');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('+5 min extends the main timer by 300 s', async () => {
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(), totalDuration: 1500, remainingSeconds: 1200, intervalId: 1 });
    const { user } = await renderTimer();
    await user.click(key(/\+5 min/i));
    expect(window.timerAPI.extendMainTimer).toHaveBeenCalledWith(300);
  });

  it('paused: Resume present, Pause absent, label PAUSED', async () => {
    setTimer({ status: 'focus', isPaused: true, sessionStartTime: new Date(2026, 8, 25, 11, 40), totalDuration: 1500, remainingSeconds: 900, intervalId: 1 });
    await renderTimer();
    expect(key(/resume/i)).toBeInTheDocument();
    expect(queryKey(/pause/i)).toBeNull();
    expect(screen.getByText(/^PAUSED ·/)).toBeInTheDocument();
    expect(screen.getByTestId('now-pill')).toHaveTextContent('Paused');
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

  it('break: Skip Break only; no picker, intention row editable, no duration strip', async () => {
    setTimer({ status: 'break', isPaused: false, sessionStartTime: new Date(), totalDuration: 300, remainingSeconds: 200, intervalId: 1, sessionCount: 2 });
    await renderTimer();
    expect(key(/skip break/i)).toBeInTheDocument();
    expect(queryKey(/begin focus/i)).toBeNull();
    expect(queryKey(/pause/i)).toBeNull();
    expect(queryKey(/kickoff/i)).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(key(/set intention/i)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Duration in minutes' })).toBeNull();
    expect(screen.getByTestId('now-pill')).toHaveTextContent('Break');
    expect(screen.getByText(/^BREAK ·/)).toBeInTheDocument();
    expect(screen.getByText(/done/i)).toHaveTextContent('2/8 done');
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

  it('kickoff warmup: label reads KICKOFF · ROLLS INTO 25M and the pill says Kickoff', async () => {
    setTimer({ status: 'focus', isPaused: false, kickoff: 'warmup', sessionStartTime: new Date(), totalDuration: 120, remainingSeconds: 100, intervalId: 1, durationMinutes: 25 });
    await renderTimer();
    expect(screen.getByText('KICKOFF · ROLLS INTO 25M')).toBeInTheDocument();
    expect(screen.getByTestId('now-pill')).toHaveTextContent('Kickoff');
    expect(key(/\+5 min/i)).toBeInTheDocument();
  });

  it('kickoff: the full label is rendered untruncated and the session counter is compact (no SESSION word)', async () => {
    setTimer({ status: 'focus', isPaused: false, kickoff: 'warmup', sessionStartTime: new Date(), totalDuration: 120, remainingSeconds: 100, intervalId: 1, durationMinutes: 25, sessionCount: 0 });
    await renderTimer();
    const label = screen.getByTestId('countdown-label');
    expect(label).toHaveTextContent('KICKOFF · ROLLS INTO 25M');
    expect(label).not.toHaveClass('truncate');
    expect(label).toHaveClass('shrink-0');
    expect(label.parentElement).toHaveClass('whitespace-nowrap');
    expect(screen.queryByText(/^Session/)).toBeNull();
    expect(screen.getByText('/8', { exact: false })).toHaveTextContent('1/8');
    expect(screen.getAllByTestId('session-square')).toHaveLength(8);
  });

  it('running with an intention: EDIT stays available and opens SetIntentionModal (parity)', async () => {
    useIntentionsStore.setState({ intentions: new Map([[today, ['Ship the rail']]]) });
    window.dashboardAPI.getDailyIntentions = vi.fn(async () => ({ date: today, intentions: ['Ship the rail'] }));
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(), totalDuration: 1500, remainingSeconds: 1200, intervalId: 1 });
    const { user } = await renderTimer();
    expect(screen.getByRole('group', { name: "Today's intention: Ship the rail" })).toBeInTheDocument();
    await user.click(key(/^edit$/i));
    expect(screen.getByText("Today's intentions")).toBeInTheDocument();
  });

  it('paused with no intention: a compact SET INTENTION key sits in the row and opens the modal', async () => {
    setTimer({ status: 'focus', isPaused: true, sessionStartTime: new Date(), totalDuration: 1500, remainingSeconds: 1200, intervalId: 1 });
    const { user } = await renderTimer();
    const set = key(/set intention/i);
    expect(set).toHaveClass('h-7');
    await user.click(set);
    expect(screen.getByText("Today's intentions")).toBeInTheDocument();
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

  it('running: label untruncated and the counter keeps the SESSION word', async () => {
    setTimer({ status: 'focus', isPaused: false, sessionStartTime: new Date(2026, 8, 25, 22, 22, 0), totalDuration: 900, remainingSeconds: 800, intervalId: 1, sessionCount: 0 });
    await renderTimer();
    const label = screen.getByTestId('countdown-label');
    expect(label).toHaveTextContent('FOCUS · 22:22 → 22:37');
    expect(label).not.toHaveClass('truncate');
    expect(screen.getByText(/^Session/)).toHaveTextContent('Session 1/8');
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { useListsStore } from './stores/listsStore';
import { useTimerStore } from './stores/timerStore';
import { resetTimer, setTimer } from './test/timerState';
import type { TaskList } from './types';

vi.mock('./components/Timer/Timer', () => ({ default: () => <div>TimerView</div> }));
vi.mock('./components/DailyLog/DailyLog', () => ({ default: () => <div>DailyLogView</div> }));
vi.mock('./components/Progress/ProgressPage', () => ({ default: () => <div>ProgressView</div> }));
vi.mock('./components/Settings/Settings', () => ({ default: () => <div>SettingsView</div> }));
// One board for both Plan scopes; the stub keeps the old per-board names so the assertions read the same.
vi.mock('./components/Plan/PlanBoard', () => ({
  default: ({ scope }: { scope: 'all' | 'list' }) => <div>{scope === 'list' ? 'ListPlanningView' : 'AllListsOverview'}</div>,
}));
vi.mock('./components/Lists/CreateListModal', () => ({ default: () => <div>CreateListModal</div> }));

function rail() {
  return within(screen.getByRole('navigation', { name: 'Primary' }));
}

describe('App', () => {
  it('boots on Now', () => {
    render(<App />);
    expect(screen.getByText('TimerView')).toBeInTheDocument();
    expect(rail().getByRole('button', { name: 'Now' })).toHaveAttribute('aria-current', 'page');
  });

  it('each rail item renders its view', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(rail().getByRole('button', { name: 'Review' }));
    expect(screen.getByText('DailyLogView')).toBeInTheDocument();

    await user.click(rail().getByRole('button', { name: 'Insights' }));
    expect(screen.getByText('ProgressView')).toBeInTheDocument();

    await user.click(rail().getByRole('button', { name: 'Settings' }));
    expect(screen.getByText('SettingsView')).toBeInTheDocument();

    await user.click(rail().getByRole('button', { name: 'Plan' }));
    expect(screen.getByText('AllListsOverview')).toBeInTheDocument();

    await user.click(rail().getByRole('button', { name: 'Now' }));
    expect(screen.getByText('TimerView')).toBeInTheDocument();
  });

  it('Plan shows the lists panel beside the overview, and a list row switches to the single-list board', async () => {
    const user = userEvent.setup();
    const ops: TaskList = { id: 'l1', name: 'Ops', color: '#ff0000', icon_path: null, task_id: null, order: 0, archived: 0, billable: 1, created_at: '' };
    window.listsAPI.getLists = vi.fn(async () => [ops]);
    render(<App />);
    await user.click(rail().getByRole('button', { name: 'Plan' }));
    expect(screen.getByText('AllListsOverview')).toBeInTheDocument();
    expect(screen.getByText('Lists')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Ops' }));
    expect(useListsStore.getState().selectedListId).toBe('l1');
    expect(screen.getByText('ListPlanningView')).toBeInTheDocument();
    expect(screen.getByText('Lists')).toBeInTheDocument();
    expect(rail().getByRole('button', { name: 'Plan' })).toHaveAttribute('aria-current', 'page');
  });

  it('the panel "+" opens CreateListModal', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(rail().getByRole('button', { name: 'Plan' }));
    await user.click(screen.getByTitle('Create list'));
    expect(screen.getByText('CreateListModal')).toBeInTheDocument();
  });
});

describe('App — kickoff takeover (Phase 4, K1)', () => {
  afterEach(() => resetTimer());

  const warmup = {
    status: 'focus' as const, kickoff: 'warmup' as const, kickoffSource: 'now' as const, isPaused: false,
    remainingSeconds: 100, totalDuration: 120, currentTaskId: null, durationMinutes: 25,
    sessionStartTime: new Date(), intervalId: 1,
  };

  it('covers every view while a kickoff is in its warmup; the views stay mounted underneath', () => {
    setTimer(warmup);
    render(<App />);
    expect(screen.getByRole('dialog', { name: 'Kickoff' })).toBeInTheDocument();
    expect(screen.getByText('TimerView')).toBeInTheDocument();
    expect(screen.getByTestId('kickoff-source')).toHaveTextContent('Started from Now');
  });

  it('is absent once the kickoff has rolled over, and Escape during the warmup stops without a row', async () => {
    setTimer({ ...warmup, kickoff: 'rolled' });
    const view = render(<App />);
    expect(screen.queryByRole('dialog', { name: 'Kickoff' })).toBeNull();
    view.unmount();

    setTimer(warmup);
    window.timerAPI.saveSession = vi.fn(async () => 'x');
    render(<App />);
    fireEvent.keyDown(window, { key: 'Escape' });
    await vi.waitFor(() => expect(useTimerStore.getState().status).toBe('idle'));
    expect(window.timerAPI.stopMainTimer).toHaveBeenCalled();
    expect(window.timerAPI.saveSession).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Kickoff' })).toBeNull();
  });
});

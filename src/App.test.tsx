import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { useListsStore } from './stores/listsStore';
import type { TaskList } from './types';

vi.mock('./components/Timer/Timer', () => ({ default: () => <div>TimerView</div> }));
vi.mock('./components/DailyLog/DailyLog', () => ({ default: () => <div>DailyLogView</div> }));
vi.mock('./components/Progress/ProgressPage', () => ({ default: () => <div>ProgressView</div> }));
vi.mock('./components/Settings/Settings', () => ({ default: () => <div>SettingsView</div> }));
vi.mock('./components/Lists/ListPlanningView', () => ({ default: () => <div>ListPlanningView</div> }));
vi.mock('./components/Lists/AllListsOverview', () => ({ default: () => <div>AllListsOverview</div> }));
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

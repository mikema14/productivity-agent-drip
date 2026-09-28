import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskPicker from './TaskPicker';
import type { PickerTask } from '../../hooks/useTaskPickerNav';
import { makeTask, makeTasks } from '../../test/fixtures';
import type { RankedTask } from '../../types';

function setup(recentTasks: RankedTask[] = makeTasks(3)) {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  render(
    <div>
      <TaskPicker recentTasks={recentTasks} onSelect={onSelect} />
      <button type="button">Outside</button>
    </div>
  );
  const input = screen.getByPlaceholderText('Search task ID or title…');
  const listbox = screen.getByRole('listbox');
  const options = () => within(listbox).queryAllByRole('option');
  const selectedIndex = () => options().findIndex(o => o.getAttribute('aria-selected') === 'true');
  return { user, onSelect, input, listbox, options, selectedIndex };
}

describe('TaskPicker', () => {
  it('shows the list on mount, with no toggle button', () => {
    const { listbox, options } = setup();
    expect(listbox).toBeVisible();
    expect(options()).toHaveLength(3);
    expect(screen.getByText('Recent tasks')).toBeInTheDocument();
    // Only the outside test button exists - the picker itself has no chevron toggle
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('renders more than five items inside the scroll container', () => {
    const { listbox, options } = setup(makeTasks(8));
    expect(options()).toHaveLength(8);
    expect(listbox).toHaveClass('picker-list');
    expect(listbox.style.overflowY).toBe('auto');
    expect(listbox.style.maxHeight).toBe('280px');
  });

  it('shows the empty state when there are no recent tasks', () => {
    const { listbox } = setup([]);
    expect(listbox).toHaveTextContent('No recent tasks. Type a task ID and press Enter.');
  });

  it('typing searches the full history and changes the label', async () => {
    const match = makeTask(42, { title: 'Invoice export' });
    window.logAPI.searchTasks = vi.fn(async () => [match]);
    const { user, input, options } = setup();

    await user.type(input, 'invoice');
    await waitFor(() => expect(screen.getByText('All tasks · 1')).toBeInTheDocument());
    expect(window.logAPI.searchTasks).toHaveBeenCalledWith('invoice', 50);
    expect(options()).toHaveLength(1);
    expect(options()[0]).toHaveTextContent('Invoice export');
  });

  it('has no highlight at rest and highlights the first row on focus', async () => {
    const { user, input, selectedIndex } = setup();
    expect(selectedIndex()).toBe(-1);
    expect(input).not.toHaveAttribute('aria-activedescendant');

    await user.click(input);
    expect(selectedIndex()).toBe(0);
  });

  it('ArrowDown twice then Enter selects the third task', async () => {
    const tasks = makeTasks(5);
    const { user, input, onSelect } = setup(tasks);
    await user.click(input);
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(tasks[2]);
  });

  it('ArrowDown scrolls the row into view and updates aria-activedescendant', async () => {
    const { user, input, options } = setup();
    await user.click(input);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();

    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', options()[1].id);
    expect(input).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('hover highlights a row without scrolling', async () => {
    const { user, options, selectedIndex } = setup(makeTasks(6));
    await user.hover(options()[3]);
    expect(selectedIndex()).toBe(3);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('ArrowDown clamps at the last row', async () => {
    const { user, input, selectedIndex } = setup(makeTasks(3));
    await user.click(input);
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(selectedIndex()).toBe(2);
  });

  it('keys do nothing when there are no results', async () => {
    const { user, input, onSelect } = setup([]);
    await user.click(input);
    await user.keyboard('{ArrowDown}{ArrowUp}{Enter}');
    expect(onSelect).not.toHaveBeenCalled();
    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(window.timerAPI.getIssue).not.toHaveBeenCalled();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('Esc clears the query first, then blurs, and the list stays visible', async () => {
    const { user, input } = setup();
    await user.type(input, 'abc');
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(input).not.toHaveFocus();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('Recent tasks')).toBeInTheDocument();
  });

  it('an outside click keeps both the list and the query', async () => {
    const { user, input } = setup();
    await user.type(input, 'ab');
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(input).toHaveValue('ab');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('a numeric ID + Enter fetches the issue and selects it', async () => {
    window.logAPI.searchTasks = vi.fn(async () => []);
    window.timerAPI.getIssue = vi.fn(async () => ({
      taskId: '777001',
      title: 'Fetched from API',
      projectId: 55,
      projectName: 'Remote project',
    }));
    const { user, input, onSelect } = setup();

    await user.type(input, '777001');
    await waitFor(() => expect(screen.getByText(/No matching tasks/)).toBeInTheDocument());
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    expect(window.timerAPI.getIssue).toHaveBeenCalledWith('https://example.test', 'test-key', '777001');
    expect(onSelect.mock.calls[0][0]).toMatchObject({
      task_id: '777001',
      title: 'Fetched from API',
      project_id: 55,
      project_name: 'Remote project',
    });
  });
});

function planned(itemId: string, taskId: string, column: 'today' | 'this_week', title = `Plan ${itemId}`): PickerTask {
  return {
    task_id: taskId, title, project_id: 0, project_name: null, last_seen_at: '',
    planned: { itemId, column, listName: 'E8 Priorities', listColor: '#3b82f6' },
  };
}

describe('TaskPicker — Planned', () => {
  beforeEach(() => localStorage.removeItem('now_pickerSource'));

  function setupPlanned(plannedTasks: PickerTask[]) {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<TaskPicker recentTasks={makeTasks(3)} plannedTasks={plannedTasks} onSelect={onSelect} />);
    const listbox = screen.getByRole('listbox');
    return { user, onSelect, listbox, options: () => within(listbox).queryAllByRole('option') };
  }

  it('opens on Planned when something is planned: Today then This week groups, list name, No task ID for ad-hoc items', () => {
    const { listbox, options } = setupPlanned([planned('t1', '689742', 'today'), planned('t2', '', 'today'), planned('w1', '689666', 'this_week')]);
    expect(screen.getByRole('button', { name: 'Planned' })).toHaveAttribute('aria-pressed', 'true');
    expect(options()).toHaveLength(3);
    expect(within(listbox).getByText('Today')).toBeInTheDocument();
    expect(within(listbox).getByText('This week')).toBeInTheDocument();
    expect(within(options()[1]).getByText('No task ID')).toBeInTheDocument();
    expect(within(options()[0]).getByText('E8 Priorities')).toBeInTheDocument();
    expect(screen.getByText('from Plan')).toBeInTheDocument();
  });

  it('opens on Recent when nothing is planned, with an empty-state line on Planned', async () => {
    const { user, options } = setupPlanned([]);
    expect(screen.getByRole('button', { name: 'Recent tasks' })).toHaveAttribute('aria-pressed', 'true');
    expect(options()).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Planned' }));
    expect(options()).toHaveLength(0);
    expect(screen.getByText('Nothing planned for today or this week.')).toBeInTheDocument();
  });

  it('remembers the choice and hands the planned row to onSelect via Enter', async () => {
    const { user, onSelect, options } = setupPlanned([planned('t1', '689742', 'today')]);
    await user.click(screen.getByRole('button', { name: 'Recent tasks' }));
    expect(localStorage.getItem('now_pickerSource')).toBe('recent');
    expect(options()).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Planned' }));
    await user.click(screen.getByPlaceholderText('Search task ID or title…'));
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ task_id: '689742', planned: expect.objectContaining({ itemId: 't1' }) }));
  });
});

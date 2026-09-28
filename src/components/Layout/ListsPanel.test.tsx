import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ListsPanel from './ListsPanel';
import { useListsStore } from '../../stores/listsStore';
import type { ListItem, TaskList } from '../../types';
import type { ViewId } from './views';

function makeList(id: string, name: string, archived: 0 | 1 = 0, overrides: Partial<TaskList> = {}): TaskList {
  return { id, name, color: '#123456', icon_path: null, task_id: null, order: 0, archived, billable: 1, created_at: '', ...overrides };
}

function makeItem(id: string, listId: string, overrides: Partial<ListItem> = {}): ListItem {
  return {
    id, list_id: listId, title: id, task_id: null, column: 'backlog', order: 0, completed: 0,
    archived: 0, completed_at: null, description: null, subtasks: '[]', billable: 1, created_at: '', ...overrides,
  };
}

function renderPanel(lists: TaskList[] = [], archivedLists: TaskList[] = [], view: ViewId = 'all-lists') {
  window.listsAPI.getLists = vi.fn(async () => lists);
  window.listsAPI.getArchivedLists = vi.fn(async () => archivedLists);
  const onNavigate = vi.fn();
  const onCreateList = vi.fn();
  render(<ListsPanel view={view} onNavigate={onNavigate} onCreateList={onCreateList} />);
  return { onNavigate, onCreateList, user: userEvent.setup() };
}

describe('ListsPanel', () => {
  beforeEach(() => {
    useListsStore.setState({ lists: [], archivedLists: [], items: [], selectedListId: null, showArchivedLists: false });
  });

  it('"+" calls onCreateList', async () => {
    const { user, onCreateList } = renderPanel();
    await user.click(screen.getByTitle('Create list'));
    expect(onCreateList).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'New list' })).toBeInTheDocument();
  });

  it('All tasks clears the selection and navigates to all-lists', async () => {
    useListsStore.setState({ selectedListId: 'x' });
    const { user, onNavigate } = renderPanel();
    await user.click(screen.getByRole('button', { name: 'All tasks' }));
    expect(useListsStore.getState().selectedListId).toBeNull();
    expect(onNavigate).toHaveBeenCalledWith('all-lists');
  });

  it('a list row shows its colour dot and selects + navigates to lists', async () => {
    const { user, onNavigate } = renderPanel([makeList('l1', 'Ops')]);
    const row = await screen.findByRole('button', { name: 'Ops' });
    expect(within(row).getByTestId('list-color')).toHaveStyle({ backgroundColor: '#123456' });
    await user.click(row);
    expect(useListsStore.getState().selectedListId).toBe('l1');
    expect(onNavigate).toHaveBeenCalledWith('lists');
  });

  it('archived lists: "Archived · n" toggles the rows (pressed), Restore unarchives', async () => {
    const { user } = renderPanel([], [makeList('a1', 'Old one', 1), makeList('a2', 'Old two', 1)]);
    const toggle = await screen.findByRole('button', { name: 'Archived · 2' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Old one')).toBeNull();

    await user.click(toggle);
    expect(screen.getByText('Old one')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archived · 2' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getAllByRole('button', { name: 'Restore' })[0]);
    expect(window.listsAPI.unarchiveList).toHaveBeenCalledWith('a1');
  });

  it('shows no archived toggle when nothing is archived', async () => {
    renderPanel([makeList('l1', 'Ops')]);
    await screen.findByRole('button', { name: 'Ops' });
    expect(screen.queryByText(/Archived/)).toBeNull();
  });

  it('shows open counts per row and on All tasks, ignoring completed and archived items', async () => {
    useListsStore.setState({
      items: [
        makeItem('a', 'l1'), makeItem('b', 'l1'), makeItem('c', 'l1', { completed: 1 }), makeItem('d', 'l1', { archived: 1 }),
        makeItem('e', 'l2'),
      ],
    });
    renderPanel([makeList('l1', 'Ops'), makeList('l2', 'Personal')]);
    const ops = await screen.findByRole('button', { name: 'Ops' });
    expect(within(ops).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'Personal' })).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'All tasks' })).getByText('3')).toBeInTheDocument();
  });

  it('row subtitles: logs to <id> / billable / not billable', async () => {
    renderPanel([
      makeList('l1', 'Ops', 0, { task_id: '679834' }),
      makeList('l2', 'Clients', 0, { billable: 1 }),
      makeList('l3', 'Personal', 0, { billable: 0 }),
    ]);
    expect(within(await screen.findByRole('button', { name: 'Ops' })).getByText('logs to 679834')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'Clients' })).getByText('billable')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'Personal' })).getByText('not billable')).toBeInTheDocument();
  });

  it('highlights the selected row in list view and All tasks in the all-lists view', async () => {
    useListsStore.setState({ selectedListId: 'l1' });
    renderPanel([makeList('l1', 'Ops'), makeList('l2', 'Personal')], [], 'lists');
    const ops = await screen.findByRole('button', { name: 'Ops' });
    expect(ops).toHaveAttribute('aria-pressed', 'true');
    expect(ops).toHaveClass('bg-focus/10');
    expect(screen.getByRole('button', { name: 'Personal' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'All tasks' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('All tasks is pressed for the all-lists view', async () => {
    useListsStore.setState({ selectedListId: 'l1' });
    renderPanel([makeList('l1', 'Ops')], [], 'all-lists');
    await screen.findByRole('button', { name: 'Ops' });
    expect(screen.getByRole('button', { name: 'All tasks' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Ops' })).toHaveAttribute('aria-pressed', 'false');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ListsPanel from './ListsPanel';
import { useListsStore } from '../../stores/listsStore';
import type { TaskList } from '../../types';

function makeList(id: string, name: string, archived: 0 | 1 = 0): TaskList {
  return { id, name, color: '#123456', icon_path: null, task_id: null, order: 0, archived, billable: 1, created_at: '' };
}

function renderPanel(lists: TaskList[] = [], archivedLists: TaskList[] = []) {
  window.listsAPI.getLists = vi.fn(async () => lists);
  window.listsAPI.getArchivedLists = vi.fn(async () => archivedLists);
  const onNavigate = vi.fn();
  const onCreateList = vi.fn();
  render(<ListsPanel view="all-lists" onNavigate={onNavigate} onCreateList={onCreateList} />);
  return { onNavigate, onCreateList, user: userEvent.setup() };
}

describe('ListsPanel', () => {
  beforeEach(() => {
    useListsStore.setState({ lists: [], archivedLists: [], selectedListId: null, showArchivedLists: false });
  });

  it('"+" calls onCreateList', async () => {
    const { user, onCreateList } = renderPanel();
    await user.click(screen.getByTitle('Create list'));
    expect(onCreateList).toHaveBeenCalledTimes(1);
  });

  it('All Tasks clears the selection and navigates to all-lists', async () => {
    useListsStore.setState({ selectedListId: 'x' });
    const { user, onNavigate } = renderPanel();
    await user.click(screen.getByRole('button', { name: 'All Tasks' }));
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

  it('archived lists: toggle shows rows, Restore unarchives', async () => {
    const { user } = renderPanel([], [makeList('a1', 'Old one', 1), makeList('a2', 'Old two', 1)]);
    const toggle = await screen.findByRole('button', { name: 'Show archived (2)' });
    expect(screen.queryByText('Old one')).toBeNull();

    await user.click(toggle);
    expect(screen.getByText('Old one')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide archived' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Restore' })[0]);
    expect(window.listsAPI.unarchiveList).toHaveBeenCalledWith('a1');
  });

  it('shows no archived toggle when nothing is archived', async () => {
    renderPanel([makeList('l1', 'Ops')]);
    await screen.findByRole('button', { name: 'Ops' });
    expect(screen.queryByText(/Show archived/)).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TodaysThree from './TodaysThree';
import { useListsStore } from '../../stores/listsStore';
import type { ListItem, TaskList } from '../../types';

function list(overrides: Partial<TaskList> = {}): TaskList {
  return { id: 'l1', name: 'Sales', color: '#f59e0b', icon_path: null, task_id: null, order: 0, archived: 0, billable: 1, created_at: '', ...overrides };
}

function item(overrides: Partial<ListItem> = {}): ListItem {
  return {
    id: 'i1', list_id: 'l1', title: 'Write proposal', task_id: null, column: 'today', order: 0, completed: 0, archived: 0,
    completed_at: null, description: null, subtasks: '[]', billable: 1, created_at: '', ...overrides,
  };
}

function seed(items: ListItem[], lists: TaskList[] = [list()]) {
  useListsStore.setState({ items, lists });
}

const outcome = (row: HTMLElement) => within(within(row).getByRole('group', { name: 'Outcome' }));

describe('TodaysThree', () => {
  beforeEach(() => {
    useListsStore.setState({ items: [], lists: [] });
  });

  it('renders nothing without today items and loads lists + items when the store is empty', async () => {
    const { container } = render(<TodaysThree />);
    expect(container).toBeEmptyDOMElement();
    await waitFor(() => expect(window.listsAPI.getLists).toHaveBeenCalled());
    await waitFor(() => expect(window.listsAPI.getAllListItems).toHaveBeenCalled());
  });

  it('shows the effective id (list-bound id wins) or No task ID, title and count; no # and no caps', () => {
    seed(
      [
        item({ id: 'a', task_id: '111', list_id: 'bound' }),
        item({ id: 'b', task_id: '222' }),
        item({ id: 'c' }),
        ...[3, 4, 5, 6].map(n => item({ id: `x${n}`, title: `Item ${n}`, order: n })),
      ],
      [list(), list({ id: 'bound', task_id: '999' })]
    );
    render(<TodaysThree />);
    const rows = screen.getAllByTestId('today-item');
    expect(rows).toHaveLength(7);
    expect(screen.getByTestId('today-count')).toHaveTextContent('7');
    expect(rows[0]).toHaveTextContent('999');
    expect(rows[0]).not.toHaveTextContent('111');
    expect(rows[1]).toHaveTextContent('222');
    expect(rows[2]).toHaveTextContent('No task ID');
    expect(screen.getByRole('region', { name: 'Today' }).textContent).not.toContain('#');
    expect(screen.getByText('Carry-overs stay in Today')).toBeInTheDocument();
  });

  it('Done is pressed for completed items and clicking it reopens; open items have Carry pressed', async () => {
    seed([item({ id: 'done', completed: 1, title: 'Shipped' }), item({ id: 'open', order: 1 })]);
    const user = userEvent.setup();
    render(<TodaysThree />);
    const [doneRow, openRow] = screen.getAllByTestId('today-item');
    expect(outcome(doneRow).getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'true');
    expect(outcome(doneRow).getByRole('button', { name: 'Carry' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(doneRow).getByText('Shipped')).toHaveClass('line-through');
    expect(outcome(openRow).getByRole('button', { name: 'Carry' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(outcome(doneRow).getByRole('button', { name: 'Done' }));
    expect(window.listsAPI.updateListItem).toHaveBeenCalledWith('done', { completed: 0 });
    await user.click(outcome(openRow).getByRole('button', { name: 'Done' }));
    expect(window.listsAPI.updateListItem).toHaveBeenCalledWith('open', { completed: 1 });
  });

  it('Carry writes nothing', async () => {
    seed([item()]);
    const user = userEvent.setup();
    render(<TodaysThree />);
    await user.click(screen.getByRole('button', { name: 'Carry' }));
    expect(window.listsAPI.updateListItem).not.toHaveBeenCalled();
    expect(screen.getByTestId('today-item')).toBeInTheDocument();
  });

  it('To week moves the item to this_week at the end of that column', async () => {
    seed([item(), item({ id: 'w1', column: 'this_week', order: 4 })]);
    const user = userEvent.setup();
    render(<TodaysThree />);
    await user.click(screen.getByRole('button', { name: 'To week' }));
    expect(window.listsAPI.updateListItem).toHaveBeenCalledWith('i1', { column: 'this_week', order: 5 });
    expect(useListsStore.getState().items.find(i => i.id === 'i1')?.column).toBe('this_week');
  });

  it('Drop moves the item to Backlog without a confirm and never deletes', async () => {
    seed([item()]);
    const confirm = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();
    render(<TodaysThree />);
    await user.click(screen.getByRole('button', { name: 'Drop' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(window.listsAPI.deleteListItem).not.toHaveBeenCalled();
    expect(window.listsAPI.updateListItem).toHaveBeenCalledWith('i1', { column: 'backlog', order: 0 });
    expect(useListsStore.getState().items.find(i => i.id === 'i1')?.column).toBe('backlog');
    expect(screen.queryByTestId('today-item')).toBeNull();
  });

  it('below wide the row wraps and the outcome group takes its own line under the title', () => {
    seed([item()]);
    render(<TodaysThree />);
    const row = screen.getByTestId('today-item');
    expect(row).toHaveClass('flex-wrap', 'wide:flex-nowrap');
    expect(screen.getByRole('group', { name: 'Outcome' })).toHaveClass('w-full', 'wide:w-auto');
    expect(screen.getByText('Write proposal')).toHaveClass('flex-1', 'min-w-0', 'truncate');
  });

  it('archived today items are not shown', () => {
    seed([item({ archived: 1 })]);
    const { container } = render(<TodaysThree />);
    expect(container).toBeEmptyDOMElement();
  });
});

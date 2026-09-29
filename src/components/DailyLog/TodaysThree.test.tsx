import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TodaysThree from './TodaysThree';
import { useListsStore } from '../../stores/listsStore';
import { carriedDays, shiftDate, todayString } from './reviewLogic';
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
    expect(screen.getByRole('heading', { name: 'Today · 7' })).toBeInTheDocument();
  });

  it('open items: joined Done / Carry / Week / Drop with Carry pressed; Done completes', async () => {
    seed([item({ id: 'open' })]);
    const user = userEvent.setup();
    render(<TodaysThree />);
    const row = screen.getByTestId('today-item');
    const group = outcome(row);
    expect(group.getAllByRole('button').map(b => b.textContent)).toEqual(['Done', 'Carry', 'Week', 'Drop']);
    expect(group.getByRole('button', { name: 'Carry' })).toHaveAttribute('aria-pressed', 'true');
    expect(group.getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(group.getByRole('button', { name: 'Done' }));
    expect(window.listsAPI.updateListItem).toHaveBeenCalledWith('open', { completed: 1 });
  });

  it('done items collapse to one line after the open ones: check · id · title · Done, which reopens', async () => {
    seed([item({ id: 'done', completed: 1, title: 'Shipped', task_id: '645001', order: 0 }), item({ id: 'open', order: 1 })]);
    const user = userEvent.setup();
    render(<TodaysThree />);
    const [openRow, doneRow] = screen.getAllByTestId('today-item');
    expect(openRow).toHaveTextContent('Write proposal');
    expect(doneRow).toHaveAttribute('data-done');
    expect(doneRow).toHaveTextContent('645001');
    expect(doneRow).toHaveTextContent('Shipped');
    expect(within(doneRow).queryByRole('group', { name: 'Outcome' })).toBeNull();
    const key = within(doneRow).getByRole('button', { name: 'Done' });
    expect(key).toHaveAttribute('aria-pressed', 'true');
    expect(key).toHaveAttribute('title', 'Reopen');
    await user.click(key);
    expect(window.listsAPI.updateListItem).toHaveBeenCalledWith('done', { completed: 0 });
  });

  it('Carried n× from two workdays in Today on (R29), not before, not without a date', () => {
    const today = todayString();
    // The latest date that reads 2 on any weekday or weekend (carriedDays itself is tested in reviewLogic)
    let twoWorkdaysAgo = shiftDate(today, -1);
    while (carriedDays(twoWorkdaysAgo, today) < 2) twoWorkdaysAgo = shiftDate(twoWorkdaysAgo, -1);
    seed([
      item({ id: 'old', today_since: twoWorkdaysAgo }),
      item({ id: 'new', order: 1, today_since: today }),
      item({ id: 'none', order: 2, today_since: null }),
    ]);
    render(<TodaysThree />);
    const [old, fresh, none] = screen.getAllByTestId('today-item');
    expect(within(old).getByTestId('carried')).toHaveTextContent('Carried 2×');
    expect(within(fresh).queryByTestId('carried')).toBeNull();
    expect(within(none).queryByTestId('carried')).toBeNull();
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
    await user.click(screen.getByRole('button', { name: 'Week' }));
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

  it('archived today items are not shown', () => {
    seed([item({ archived: 1 })]);
    const { container } = render(<TodaysThree />);
    expect(container).toBeEmptyDOMElement();
  });
});

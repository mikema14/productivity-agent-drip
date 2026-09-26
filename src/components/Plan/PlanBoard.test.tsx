import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import PlanBoard, { SHOW_DONE_KEY, SHOW_TASK_IDS_KEY } from './PlanBoard';
import { useListsStore } from '../../stores/listsStore';
import { useTimerStore } from '../../stores/timerStore';
import type { ListItem, PomodoroSession, TaskList } from '../../types';

type DragHandlers = {
  onDragStart?: (e: { active: { id: string } }) => void;
  onDragEnd?: (e: { active: { id: string }; over: { id: string } | null }) => void;
};
const dnd = () => (globalThis as unknown as { __dnd: DragHandlers }).__dnd;

vi.mock('@dnd-kit/core', async (orig) => {
  const mod = await orig<typeof import('@dnd-kit/core')>();
  return {
    ...mod,
    DndContext: ({ children, onDragEnd, onDragStart }: { children: ReactNode } & DragHandlers) => {
      (globalThis as unknown as { __dnd: DragHandlers }).__dnd = { onDragEnd, onDragStart };
      return <>{children}</>;
    },
    DragOverlay: () => null,
  };
});

vi.mock('../Lists/TaskDetailInline', () => ({
  default: (props: { item: ListItem; listTaskId?: string | null; isFolderList: boolean; onClose: () => void }) => (
    <div data-testid="task-detail">
      detail:{props.item.id}:{String(props.listTaskId)}:{String(props.isFolderList)}
      <button onClick={props.onClose}>close detail</button>
    </div>
  ),
}));

vi.mock('../Lists/AddItemInline', () => ({
  default: (props: { defaultBillable?: boolean; column: string; onAdd: (t: string, id: string | null, b: boolean) => Promise<void>; onCancel: () => void }) => (
    <div data-testid="add-item">
      add:{props.column}:{String(props.defaultBillable)}
      <button onClick={() => props.onAdd('New task', '123', props.defaultBillable ?? true)}>submit add</button>
      <button onClick={() => props.onAdd('Not billable task', null, false)}>submit add unbillable</button>
      <button onClick={props.onCancel}>cancel add</button>
    </div>
  ),
}));

const ops: TaskList = { id: 'l1', name: 'Ops', color: '#ff0000', icon_path: null, task_id: null, order: 0, archived: 0, billable: 1, created_at: '' };
const bound: TaskList = { id: 'l2', name: 'Bound', color: '#00ff00', icon_path: null, task_id: '679834', order: 1, archived: 0, billable: 0, created_at: '' };

const NOW = Date.now();
const DAY = 86_400_000;
const sqlite = (ms: number) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);

function item(id: string, overrides: Partial<ListItem> = {}): ListItem {
  return {
    id, list_id: 'l1', title: `Title ${id}`, task_id: null, column: 'backlog', order: 0, completed: 0,
    archived: 0, completed_at: null, description: null, subtasks: '[]', billable: 1, created_at: sqlite(NOW - DAY), ...overrides,
  };
}

const baseItems: ListItem[] = [
  item('t1', { column: 'today', order: 0, task_id: '689742' }),
  item('t2', { column: 'today', order: 1 }),
  item('td', { column: 'today', order: 2, completed: 1, task_id: '600009' }),
  item('w1', { column: 'this_week', order: 0, list_id: 'l2', task_id: '111' }),
  item('b1', { column: 'backlog', order: 0, created_at: sqlite(NOW - 10 * DAY), subtasks: JSON.stringify([{ id: 's1', title: 'Sub one', completed: false }, { id: 's2', title: 'Sub two', completed: true }]) }),
  item('b2', { column: 'backlog', order: 1, created_at: sqlite(NOW - 20 * DAY) }),
];

function section(name: string) {
  return within(screen.getByRole('region', { name }));
}

function card(title: string): HTMLElement {
  return screen.getByText(title).closest('[data-testid="plan-card"]') as HTMLElement;
}

function renderBoard(scope: 'all' | 'list' = 'all', items: ListItem[] = baseItems, lists: TaskList[] = [ops, bound]) {
  useListsStore.setState({ lists, items, archivedLists: [] });
  const onNavigate = vi.fn();
  render(<PlanBoard scope={scope} onNavigate={onNavigate} />);
  return { onNavigate, user: userEvent.setup() };
}

describe('PlanBoard — all scope', () => {
  beforeEach(() => {
    localStorage.clear();
    useListsStore.setState({ lists: [], items: [], selectedListId: null, archivedLists: [] });
    useTimerStore.setState({ status: 'idle' });
  });
  afterEach(() => localStorage.clear());

  it('renders Today · This week · Backlog in mockup order, Today amber-framed, and the Done column by default', () => {
    renderBoard();
    const regions = screen.getAllByRole('region').map(r => r.getAttribute('aria-label'));
    expect(regions).toEqual(['Today', 'This week', 'Backlog', 'Done']);
    expect(screen.getByRole('region', { name: 'Today' })).toHaveClass('border-focus/30');
    expect(screen.getByRole('region', { name: 'Backlog' })).toHaveClass('border-drip-elevated');
    expect(screen.getByTestId('plan-grid')).toHaveClass('wide:grid-cols-4');
  });

  it('sub-header: All tasks · N across M lists', () => {
    renderBoard();
    expect(screen.getByTestId('plan-subheader')).toHaveTextContent('All tasks');
    expect(screen.getByTestId('plan-subheader')).toHaveTextContent('5 across 2 lists');
  });

  it('Done on: completed items appear only in Done; toggling off hides them and writes the persisted key (P10)', async () => {
    const { user } = renderBoard();
    expect(section('Done').getByText('Title td')).toBeInTheDocument();
    expect(section('Today').queryByText('Title td')).toBeNull();
    expect(section('Today').getByText('2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(localStorage.getItem(SHOW_DONE_KEY)).toBe('false');
    expect(screen.queryByRole('region', { name: 'Done' })).toBeNull();
    expect(screen.queryByText('Title td')).toBeNull();
    expect(screen.getByTestId('plan-grid')).toHaveClass('wide:grid-cols-3');
  });

  it('honours a stored Done=false on mount', () => {
    localStorage.setItem(SHOW_DONE_KEY, 'false');
    renderBoard();
    expect(screen.queryByRole('region', { name: 'Done' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('IDs: shown without # by default (P11), hidden in all scope when toggled off, key written; stored false honoured', async () => {
    const { user } = renderBoard();
    expect(within(card('Title t1')).getByText('689742')).toBeInTheDocument();
    expect(within(card('Title t1')).queryByText('#689742')).toBeNull();
    expect(within(card('Title t2')).getByText('No task ID')).toBeInTheDocument();
    // w1 has its own id in a task-bound list: its own id is shown
    expect(within(card('Title w1')).getByText('111')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'IDs' }));
    expect(localStorage.getItem(SHOW_TASK_IDS_KEY)).toBe('false');
    expect(within(card('Title t1')).queryByText('689742')).toBeNull();
    expect(within(card('Title t2')).queryByText('No task ID')).toBeNull();
  });

  it('honours a stored IDs=false on mount', () => {
    localStorage.setItem(SHOW_TASK_IDS_KEY, 'false');
    renderBoard();
    expect(screen.getByRole('button', { name: 'IDs' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(card('Title t1')).queryByText('689742')).toBeNull();
  });

  it('Group by list: per-column groups with dot + name + count, list tag hidden on cards', async () => {
    const { user } = renderBoard();
    expect(within(card('Title t1')).getByText('Ops')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Group by list' }));
    expect(screen.getByRole('button', { name: 'Group by list' })).toHaveAttribute('aria-pressed', 'true');
    const today = section('Today');
    expect(today.getByText('Ops')).toBeInTheDocument();
    expect(within(card('Title t1')).queryByText('Ops')).toBeNull();
    expect(section('This week').getByText('Bound')).toBeInTheDocument();
  });

  it('list filter pills: one list hides the others, All clears', async () => {
    const { user } = renderBoard();
    const filters = within(screen.getByTestId('plan-list-filters'));
    await user.click(filters.getByRole('button', { name: 'Bound' }));
    expect(screen.queryByText('Title t1')).toBeNull();
    expect(screen.getByText('Title w1')).toBeInTheDocument();
    expect(filters.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(filters.getByRole('button', { name: 'All' }));
    expect(screen.getByText('Title t1')).toBeInTheDocument();
    expect(filters.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('a filter on a list that disappears is pruned: the remaining list shows again', async () => {
    const { user } = renderBoard();
    await user.click(within(screen.getByTestId('plan-list-filters')).getByRole('button', { name: 'Ops' }));
    expect(screen.queryByText('Title w1')).toBeNull();
    // Ops gets archived: one list left, no pills — Bound's items must not stay hidden.
    act(() => { useListsStore.setState({ lists: [bound] }); });
    expect(screen.queryByTestId('plan-list-filters')).toBeNull();
    expect(screen.getByText('Title w1')).toBeInTheDocument();
  });

  it('with three lists, archiving a filtered one keeps the other filter and shows the rest of the pills', async () => {
    const third: TaskList = { ...ops, id: 'l3', name: 'Third', order: 2 };
    const items = [...baseItems, item('x1', { list_id: 'l3', column: 'today', order: 5 })];
    const { user } = renderBoard('all', items, [ops, bound, third]);
    const pills = () => within(screen.getByTestId('plan-list-filters'));
    await user.click(pills().getByRole('button', { name: 'Ops' }));
    await user.click(pills().getByRole('button', { name: 'Third' }));
    expect(screen.queryByText('Title w1')).toBeNull();
    act(() => { useListsStore.setState({ lists: [bound, third] }); });
    expect(pills().getByRole('button', { name: 'Third' })).toHaveAttribute('aria-pressed', 'true');
    expect(pills().getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Title x1')).toBeInTheDocument();
    expect(screen.queryByText('Title w1')).toBeNull();
  });

  it('no filter row with a single list', () => {
    renderBoard('all', baseItems.filter(i => i.list_id === 'l1'), [ops]);
    expect(screen.queryByTestId('plan-list-filters')).toBeNull();
    expect(screen.getByTestId('plan-subheader')).toHaveTextContent('across 1 list');
  });

  it('Mark done / Mark not done call updateItem', async () => {
    const { user } = renderBoard();
    await user.click(within(card('Title t1')).getByRole('button', { name: 'Mark done' }));
    expect(window.listsAPI.updateListItem).toHaveBeenCalledWith('t1', { completed: 1 });
    await user.click(within(card('Title td')).getByRole('button', { name: 'Mark not done' }));
    expect(window.listsAPI.updateListItem).toHaveBeenCalledWith('td', { completed: 0 });
  });

  it('title click toggles TaskDetailInline with listTaskId and isFolderList', async () => {
    const { user } = renderBoard();
    await user.click(screen.getByText('Title w1'));
    expect(screen.getByTestId('task-detail')).toHaveTextContent('detail:w1:679834:false');
    await user.click(screen.getByText('close detail'));
    expect(screen.queryByTestId('task-detail')).toBeNull();
    await user.click(screen.getByText('Title t1'));
    expect(screen.getByTestId('task-detail')).toHaveTextContent('detail:t1:null:true');
    await user.click(screen.getByText('Title t1'));
    expect(screen.queryByTestId('task-detail')).toBeNull();
  });

  it('subtasks badge opens the checklist; ticking a subtask writes the subtasks JSON', async () => {
    const { user } = renderBoard();
    await user.click(screen.getByRole('button', { name: '1/2 Subtasks' }));
    expect(screen.getByTestId('plan-card-checklist')).toBeInTheDocument();
    expect(screen.getByText('Sub one')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark subtask done: Sub one' }));
    expect(window.listsAPI.updateListItem).toHaveBeenCalledWith('b1', {
      subtasks: JSON.stringify([{ id: 's1', title: 'Sub one', completed: true }, { id: 's2', title: 'Sub two', completed: true }]),
    });
    // The optimistic store update already shows 2/2; clicking the badge again collapses the checklist
    await user.click(screen.getByRole('button', { name: '2/2 Subtasks' }));
    expect(screen.queryByTestId('plan-card-checklist')).toBeNull();
  });

  it('Move right from backlog appends to this_week; no Move right on today; no Move left on backlog; none on done cards', async () => {
    const { user } = renderBoard();
    const b1 = within(card('Title b1'));
    expect(b1.queryByTitle('Move left')).toBeNull();
    await user.click(b1.getByTitle('Move right'));
    expect(window.listsAPI.updateListItem).toHaveBeenCalledWith('b1', { column: 'this_week', order: 1 });
    const t1 = within(card('Title t1'));
    expect(t1.queryByTitle('Move right')).toBeNull();
    expect(t1.getByTitle('Move left')).toBeInTheDocument();
    const td = within(card('Title td'));
    expect(td.queryByTitle('Move left')).toBeNull();
    expect(td.queryByTitle('Move right')).toBeNull();
    expect(td.getByTitle('Delete')).toBeInTheDocument();
  });

  it('hover actions carry the focus-within class so keyboard users reach them', () => {
    renderBoard();
    const actions = card('Title t1').querySelector('.plan-card-actions');
    expect(actions).not.toBeNull();
    expect(within(actions as HTMLElement).getByTitle('Delete')).toBeInTheDocument();
  });

  it('Move to list: current list ticked, choosing another updates list_id, outside click closes', async () => {
    const { user } = renderBoard();
    await user.click(within(card('Title t1')).getByTitle('Move to list'));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Ops' })).toHaveClass('text-focus');
    await user.click(within(menu).getByRole('menuitem', { name: 'Bound' }));
    expect(window.listsAPI.updateListItem).toHaveBeenCalledWith('t1', { list_id: 'l2' });
    expect(screen.queryByRole('menu')).toBeNull();

    await user.click(within(card('Title t2')).getByTitle('Move to list'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Delete removes without confirm', async () => {
    const { user } = renderBoard();
    await user.click(within(card('Title b2')).getByTitle('Delete'));
    expect(window.listsAPI.deleteListItem).toHaveBeenCalledWith('b2');
    expect(screen.queryByText('Title b2')).toBeNull();
  });

  it('"All Clear" empty state in an empty column', () => {
    renderBoard('all', baseItems.filter(i => i.column !== 'this_week'));
    expect(section('This week').getByText('All Clear')).toBeInTheDocument();
    expect(section('Today').queryByText('All Clear')).toBeNull();
  });

  it('drag end: over a column moves, over Done completes, out of Done uncompletes', () => {
    renderBoard();
    act(() => dnd().onDragEnd!({ active: { id: 'b1' }, over: { id: 'today' } }));
    expect(window.listsAPI.updateListItem).toHaveBeenCalledWith('b1', { column: 'today', order: 2 });
    act(() => dnd().onDragEnd!({ active: { id: 'b2' }, over: { id: 'done' } }));
    expect(window.listsAPI.updateListItem).toHaveBeenCalledWith('b2', { completed: 1 });
    act(() => dnd().onDragEnd!({ active: { id: 'td' }, over: { id: 'this_week' } }));
    expect(window.listsAPI.updateListItem).toHaveBeenCalledWith('td', { completed: 0, column: 'this_week' });
    vi.mocked(window.listsAPI.updateListItem).mockClear();
    act(() => dnd().onDragEnd!({ active: { id: 'b1' }, over: null }));
    expect(window.listsAPI.updateListItem).not.toHaveBeenCalled();
  });

  it('dashed footer reads "Drop a task here" and switches to "Drop here" during a drag', () => {
    renderBoard();
    expect(section('Today').getByText('Drop a task here')).toBeInTheDocument();
    expect(section('Done').queryByText('Drop a task here')).toBeNull();
    act(() => dnd().onDragStart!({ active: { id: 'b1' } }));
    expect(section('Today').getByText('Drop here')).toBeInTheDocument();
    act(() => dnd().onDragEnd!({ active: { id: 'b1' }, over: null }));
    expect(section('Today').getByText('Drop a task here')).toBeInTheDocument();
  });

  it('backlog groups by age with labels and an Nd badge; Leexi provenance shows "from call · <date>"', () => {
    const items = [
      ...baseItems,
      item('b3', { column: 'backlog', order: 2, created_at: sqlite(NOW - 40 * DAY), description: 'From Leexi call: KKS sync (Wed 23 Sep)\nhttps://app.leexi.ai/calls/x' }),
      item('b4', { column: 'backlog', order: 3, created_at: new Date(NOW).toISOString() }),
    ];
    renderBoard('all', items);
    const backlog = section('Backlog');
    expect(backlog.getByText('New this week')).toBeInTheDocument();
    expect(backlog.getByText('Older than 14 days')).toBeInTheDocument();
    expect(backlog.getByText('Everything else')).toBeInTheDocument();
    expect(within(screen.getByTestId('backlog-group-new')).getByText('Title b4')).toBeInTheDocument();
    expect(within(screen.getByTestId('backlog-group-stale')).getByText('Title b2')).toBeInTheDocument();
    expect(within(card('Title b2')).getByText('20d')).toBeInTheDocument();
    expect(within(card('Title b3')).getByText('from call · Wed 23 Sep')).toBeInTheDocument();
    expect(within(card('Title b1')).queryByText(/\dd$/)).toBeNull();
  });

  it('no "Add a task" footer in all scope', () => {
    renderBoard();
    expect(screen.queryByText('Add a task')).toBeNull();
    expect(screen.queryByTestId('add-item')).toBeNull();
  });

  it('Done cards render struck-through and muted', () => {
    renderBoard();
    expect(card('Title td')).toHaveClass('opacity-50');
    expect(screen.getByText('Title td')).toHaveClass('line-through');
  });
});

describe('PlanBoard — list scope', () => {
  beforeEach(() => {
    localStorage.clear();
    useListsStore.setState({ lists: [], items: [], selectedListId: null, archivedLists: [] });
    useTimerStore.setState({ status: 'idle' });
  });
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function renderList(listId: string | null = 'l1', items: ListItem[] = baseItems, lists: TaskList[] = [ops, bound]) {
    useListsStore.setState({ selectedListId: listId });
    return renderBoard('list', items, lists);
  }

  it('selects lists[0] when nothing is selected', () => {
    renderList(null);
    expect(useListsStore.getState().selectedListId).toBe('l1');
  });

  it('empty state when there are no lists', () => {
    renderList(null, [], []);
    expect(screen.getByText('No list selected')).toBeInTheDocument();
    expect(screen.getByText('Create a list from the Lists panel to get started.')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-subheader')).toBeNull();
  });

  it('shows only the selected list, three columns, completed items inline (strikethrough) with a done count, no Done column and no toggles', () => {
    renderList('l1');
    const regions = screen.getAllByRole('region').map(r => r.getAttribute('aria-label'));
    expect(regions).toEqual(['Today', 'This week', 'Backlog']);
    expect(screen.queryByText('Title w1')).toBeNull();
    expect(section('Today').getByText('Title td')).toHaveClass('line-through');
    expect(section('Today').getByText('· 1 done')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'IDs' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Group by list' })).toBeNull();
    expect(screen.queryByTestId('plan-list-filters')).toBeNull();
  });

  it('sub-header: dot, name, list id without #, BillableToggle → updateList, remaining count', async () => {
    const { user } = renderList('l2', [...baseItems, item('x', { list_id: 'l2', column: 'backlog', completed: 1 })]);
    const sub = within(screen.getByTestId('plan-subheader'));
    expect(sub.getByText('Bound')).toBeInTheDocument();
    expect(sub.getByText('679834')).toBeInTheDocument();
    expect(sub.queryByText('#679834')).toBeNull();
    expect(sub.getByText('1 remaining')).toBeInTheDocument();
    const toggle = sub.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveTextContent('Billable');
    await user.click(toggle);
    expect(window.listsAPI.updateList).toHaveBeenCalledWith('l2', { billable: 1 });
  });

  it('sub-header for a folder list says "Billable default" and "This list has no tasks" when empty', () => {
    renderList('l1', []);
    const sub = within(screen.getByTestId('plan-subheader'));
    expect(sub.getByRole('switch')).toHaveTextContent('Billable default');
    expect(sub.getByText('This list has no tasks')).toBeInTheDocument();
    expect(section('Today').getByText('All Clear')).toBeInTheDocument();
  });

  it('Archive: confirm accepted → archiveList; declined → nothing', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = renderList('l1');
    await user.click(screen.getByRole('button', { name: 'Archive list' }));
    expect(confirmSpy).toHaveBeenCalledWith('Archive this list? It will be hidden from Lists.');
    expect(window.listsAPI.archiveList).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Archive list' }));
    expect(window.listsAPI.archiveList).toHaveBeenCalledWith('l1');
  });

  it('per-column progress bar width = done / total', () => {
    renderList('l1');
    const bar = section('Today').getByTestId('column-progress');
    expect(bar).toHaveStyle({ width: '33.33333333333333%', backgroundColor: '#ff0000' });
    expect(section('This week').queryByTestId('column-progress')).toBeNull();
  });

  it('"Add a task" opens AddItemInline in the column; submit → createItem with the list billable default and order = open count', async () => {
    const { user } = renderList('l2', [...baseItems, item('y', { list_id: 'l2', column: 'this_week', order: 1 })]);
    await user.click(section('This week').getByRole('button', { name: 'Add a task' }));
    expect(section('This week').getByTestId('add-item')).toHaveTextContent('add:this_week:false');
    expect(section('Today').queryByTestId('add-item')).toBeNull();
    await user.click(screen.getByText('submit add'));
    expect(window.listsAPI.createListItem).toHaveBeenCalledWith(expect.objectContaining({
      list_id: 'l2', title: 'New task', task_id: '123', column: 'this_week', order: 2, billable: 0, completed: 0, subtasks: '[]',
    }));
    await user.click(screen.getByText('submit add unbillable'));
    expect(window.listsAPI.createListItem).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Not billable task', billable: 0, task_id: null }));
    await user.click(screen.getByText('cancel add'));
    expect(screen.queryByTestId('add-item')).toBeNull();
  });

  it('a billable list seeds AddItemInline with true and the add form overrides win', async () => {
    const { user } = renderList('l1');
    await user.click(section('Backlog').getByRole('button', { name: 'Add a task' }));
    expect(section('Backlog').getByTestId('add-item')).toHaveTextContent('add:backlog:true');
    await user.click(screen.getByText('submit add unbillable'));
    expect(window.listsAPI.createListItem).toHaveBeenLastCalledWith(expect.objectContaining({ list_id: 'l1', column: 'backlog', order: 2, billable: 0 }));
  });

  it('ids always show in list scope; an inherited list id shows nothing instead of "No task ID"', () => {
    localStorage.setItem(SHOW_TASK_IDS_KEY, 'false');
    renderList('l2', [...baseItems, item('z', { list_id: 'l2', column: 'today' })]);
    expect(within(card('Title w1')).getByText('111')).toBeInTheDocument();
    expect(within(card('Title z')).queryByText('No task ID')).toBeNull();
    // no list tag in list scope
    expect(within(card('Title w1')).queryByText('Bound')).toBeNull();
  });

  it('footer button reads "Drop here" during a drag and drops move within the list', () => {
    renderList('l1');
    act(() => dnd().onDragStart!({ active: { id: 'b1' } }));
    expect(section('Today').getByRole('button', { name: 'Drop here' })).toBeInTheDocument();
    act(() => dnd().onDragEnd!({ active: { id: 'b1' }, over: { id: 'today' } }));
    expect(window.listsAPI.updateListItem).toHaveBeenCalledWith('b1', { column: 'today', order: 2 });
    expect(section('Today').getByRole('button', { name: 'Add a task' })).toBeInTheDocument();
  });

  it('completed inline cards are not draggable and keep the complete control + Delete', () => {
    renderList('l1');
    const done = card('Title td');
    expect(done.closest('[aria-roledescription="sortable"]')).toBeNull();
    expect(card('Title t1').closest('[aria-roledescription="sortable"]')).not.toBeNull();
    expect(within(done).getByRole('button', { name: 'Mark not done' })).toBeInTheDocument();
    expect(within(done).getByTitle('Delete')).toBeInTheDocument();
  });

  it('backlog age badge stays in list scope even after Group by list was turned on in All tasks', async () => {
    useListsStore.setState({ lists: [ops, bound], items: baseItems, archivedLists: [], selectedListId: 'l1' });
    const user = userEvent.setup();
    const { rerender } = render(<PlanBoard scope="all" onNavigate={vi.fn()} />);
    expect(within(card('Title b2')).getByText('20d')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Group by list' }));
    // All scope grouped by list: age groups are off, so is the badge (unchanged).
    expect(within(card('Title b2')).queryByText('20d')).toBeNull();
    // The same component instance switches to list scope: the badge is back.
    rerender(<PlanBoard scope="list" onNavigate={vi.fn()} />);
    expect(within(card('Title b2')).getByText('20d')).toBeInTheDocument();
  });

  it('TaskDetailInline in list scope receives the list task id', async () => {
    const { user } = renderList('l2');
    await user.click(screen.getByText('Title w1'));
    expect(screen.getByTestId('task-detail')).toHaveTextContent('detail:w1:679834:false');
  });
});

describe('PlanBoard — Today extras', () => {
  const today = new Date().toISOString().split('T')[0];
  const session = (i: number, minutes: number, source: 'pomodoro' | 'break' = 'pomodoro'): PomodoroSession => ({
    id: `s${i}`, start_at: `${today}T09:00:00.000Z`, end_at: null, duration_minutes: minutes, task_id: '689742', source,
    comment: null, logged: 0, log_sent_at: null, server_entry_id: null,
  } as PomodoroSession);

  beforeEach(() => {
    localStorage.clear();
    useListsStore.setState({ lists: [], items: [], selectedListId: null, archivedLists: [] });
    useTimerStore.setState({ status: 'idle', pendingSelection: null });
  });
  afterEach(() => localStorage.clear());

  it('capacity line counts non-break sessions only', async () => {
    window.timerAPI.getSessions = vi.fn(async () => [session(1, 25), session(2, 5, 'break'), session(3, 160)]);
    renderBoard();
    expect(await section('Today').findByText('3h 05m / 6h focus')).toBeInTheDocument();
  });

  it('capacity line with no sessions', async () => {
    renderBoard();
    expect(await section('Today').findByText('0m / 6h focus')).toBeInTheDocument();
  });

  it('tracked minutes: today on Today cards, week (wk) on This week cards, nothing without data, none on Backlog; week line sums the week', async () => {
    window.logAPI.getTaskMinutesByRange = vi.fn(async (from: string, to: string): Promise<Record<string, number>> =>
      from === to ? { '689742': 75 } : { '689742': 90, '111': 130 }
    );
    renderBoard();
    expect(await within(card('Title t1')).findByText('1h 15m')).toBeInTheDocument();
    expect(within(card('Title t2')).queryByText('—')).toBeNull();
    expect(within(card('Title t2')).queryByText(/\d+m/)).toBeNull();
    expect(within(card('Title w1')).getByText('2h 10m wk')).toBeInTheDocument();
    expect(within(card('Title b1')).queryByText('—')).toBeNull();
    expect(within(card('Title b1')).queryByText(/\d+m/)).toBeNull();
    expect(section('This week').getByText('3h 40m tracked this week')).toBeInTheDocument();
    expect(window.logAPI.getTaskMinutesByRange).toHaveBeenCalledWith(today, today);
  });

  it('Start on <id>: first open Today item with an effective id; click hands off to Now', async () => {
    const { user, onNavigate } = renderBoard();
    const cta = section('Today').getByRole('button', { name: 'Start on 689742' });
    await user.click(cta);
    expect(useTimerStore.getState().pendingSelection).toEqual({ taskId: '689742', title: 'Title t1' });
    expect(onNavigate).toHaveBeenCalledWith('timer');
  });

  it('Start on uses the list id when the list is task-bound (§5.3)', () => {
    renderBoard('all', [item('q', { list_id: 'l2', column: 'today', order: 0 })]);
    expect(section('Today').getByRole('button', { name: 'Start on 679834' })).toBeInTheDocument();
  });

  it('no Start on without a candidate, and none while a session runs', () => {
    renderBoard('all', [item('q', { column: 'today' })]);
    expect(screen.queryByRole('button', { name: /^Start on/ })).toBeNull();
  });

  it('Start on hidden while focusing', () => {
    useTimerStore.setState({ status: 'focus' });
    renderBoard();
    expect(screen.queryByRole('button', { name: /^Start on/ })).toBeNull();
  });
});

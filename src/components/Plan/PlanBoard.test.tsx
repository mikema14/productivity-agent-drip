import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import PlanBoard, { SHOW_DONE_KEY, SHOW_TASK_IDS_KEY } from './PlanBoard';
import { useListsStore } from '../../stores/listsStore';
import { useTimerStore } from '../../stores/timerStore';
import type { ListItem, TaskList } from '../../types';

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

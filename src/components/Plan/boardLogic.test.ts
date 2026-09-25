import { describe, it, expect } from 'vitest';
import {
  COLUMNS, DATA_ORDER, effectiveTaskId, partition, groupBacklog, ageBadge, groupByList, resolveDrop,
  arrowTargets, listSubtitle, provenance, capacityLine, formatMinutesPadded, weekLabel, weekRange,
  isoWeek, getMonday, startCandidate,
} from './boardLogic';
import type { ListItem, TaskList } from '../../types';

function item(id: string, overrides: Partial<ListItem> = {}): ListItem {
  return {
    id, list_id: 'l1', title: id, task_id: null, column: 'backlog', order: 0, completed: 0,
    archived: 0, completed_at: null, description: null, subtasks: '[]', billable: 1, created_at: '', ...overrides,
  };
}

function list(id: string, overrides: Partial<TaskList> = {}): TaskList {
  return { id, name: id, color: '#fff', icon_path: null, task_id: null, order: 0, archived: 0, billable: 1, created_at: '', ...overrides };
}

const NOW = new Date(2026, 8, 25, 12, 0, 0).getTime(); // Fri 25 Sep 2026, local noon
const DAY = 86_400_000;
const sqlite = (ms: number) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19); // UTC, no Z

describe('columns', () => {
  it('display order is Today · This week · Backlog, data order is Backlog → This week → Today', () => {
    expect(COLUMNS.map(c => c.key)).toEqual(['today', 'this_week', 'backlog']);
    expect(COLUMNS.map(c => c.label)).toEqual(['Today', 'This week', 'Backlog']);
    expect(DATA_ORDER).toEqual(['backlog', 'this_week', 'today']);
  });
});

describe('effectiveTaskId', () => {
  it('prefers the list id, then the item id, else null', () => {
    expect(effectiveTaskId(item('a', { task_id: '1' }), list('l', { task_id: '9' }))).toBe('9');
    expect(effectiveTaskId(item('a', { task_id: '1' }), list('l'))).toBe('1');
    expect(effectiveTaskId(item('a'), undefined)).toBeNull();
  });
});

describe('partition', () => {
  const items = [
    item('t1', { column: 'today', order: 1 }),
    item('t0', { column: 'today', order: 0 }),
    item('td', { column: 'today', completed: 1 }),
    item('w0', { column: 'this_week', list_id: 'l2' }),
    item('b0', { column: 'backlog' }),
    item('bd', { column: 'backlog', completed: 1, list_id: 'l2' }),
    item('arch', { column: 'today', archived: 1 }),
  ];

  it('column mode: completed items go to the Done column, sorted by order', () => {
    const p = partition(items, { scope: 'all', completedMode: 'column' });
    expect(p.columns.today.open.map(i => i.id)).toEqual(['t0', 't1']);
    expect(p.columns.today.done).toEqual([]);
    expect(p.doneColumn.map(i => i.id)).toEqual(['td', 'bd']);
  });

  it('hidden mode: completed items appear nowhere', () => {
    const p = partition(items, { scope: 'all', completedMode: 'hidden' });
    expect(p.doneColumn).toEqual([]);
    expect(p.columns.today.done).toEqual([]);
    expect(p.columns.backlog.done).toEqual([]);
    expect(p.columns.backlog.open.map(i => i.id)).toEqual(['b0']);
  });

  it('inline mode: completed items stay in their column', () => {
    const p = partition(items, { scope: 'all', completedMode: 'inline' });
    expect(p.columns.today.done.map(i => i.id)).toEqual(['td']);
    expect(p.columns.backlog.done.map(i => i.id)).toEqual(['bd']);
    expect(p.doneColumn).toEqual([]);
  });

  it('archived items are excluded everywhere', () => {
    const p = partition(items, { scope: 'all', completedMode: 'inline' });
    const all = [...p.columns.today.open, ...p.columns.today.done, ...p.doneColumn];
    expect(all.some(i => i.id === 'arch')).toBe(false);
  });

  it('list scope keeps only the selected list', () => {
    const p = partition(items, { scope: 'list', listId: 'l2', completedMode: 'inline' });
    expect(p.columns.this_week.open.map(i => i.id)).toEqual(['w0']);
    expect(p.columns.today.open).toEqual([]);
    expect(p.columns.backlog.done.map(i => i.id)).toEqual(['bd']);
  });

  it('all scope filters by the selected lists; an empty filter set means every list', () => {
    const filtered = partition(items, { scope: 'all', completedMode: 'column', filters: new Set(['l2']) });
    expect(filtered.columns.today.open).toEqual([]);
    expect(filtered.columns.this_week.open.map(i => i.id)).toEqual(['w0']);
    expect(filtered.doneColumn.map(i => i.id)).toEqual(['bd']);
    const all = partition(items, { scope: 'all', completedMode: 'column', filters: new Set() });
    expect(all.columns.today.open).toHaveLength(2);
  });
});

describe('groupBacklog', () => {
  const monday = getMonday(new Date(NOW)); // Mon 21 Sep 00:00 local

  it('created exactly at Monday 00:00 local is "New this week"', () => {
    const groups = groupBacklog([item('a', { created_at: new Date(monday).toISOString() })], monday, NOW);
    expect(groups.map(g => g.key)).toEqual(['new']);
    expect(groups[0].label).toBe('New this week');
  });

  it('13 days old is "Everything else"; 14 days is "Older than 14 days" with a 14d badge', () => {
    const thirteen = item('r', { created_at: sqlite(NOW - 13 * DAY) });
    const fourteen = item('s', { created_at: sqlite(NOW - 14 * DAY) });
    const groups = groupBacklog([thirteen, fourteen], monday, NOW);
    expect(groups.map(g => g.key)).toEqual(['stale', 'rest']);
    expect(groups[0].items.map(i => i.id)).toEqual(['s']);
    expect(groups[1].items.map(i => i.id)).toEqual(['r']);
    expect(ageBadge(fourteen, NOW)).toBe('14d');
    expect(ageBadge(thirteen, NOW)).toBeNull();
    expect(groups[0].label).toBe('Older than 14 days');
  });

  it('parses SQLite UTC timestamps (no Z) as UTC', () => {
    // 1 minute before local Monday midnight, written as SQLite UTC → previous week, not new
    const beforeMonday = sqlite(monday.getTime() - 60_000);
    const groups = groupBacklog([item('a', { created_at: beforeMonday })], monday, NOW);
    expect(groups[0].key).toBe('rest');
  });

  it('omits empty groups, preserves order inside a group, and puts unparseable dates in "Everything else"', () => {
    const groups = groupBacklog([item('x', { created_at: '' }), item('y', { created_at: sqlite(NOW - 2 * DAY) })], monday, NOW);
    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe('new');
    expect(groups[1].items.map(i => i.id)).toEqual(['x']);
  });
});

describe('groupByList', () => {
  it('groups by list in first-seen order, unknown list stays undefined', () => {
    const lists = [list('l1'), list('l2')];
    const groups = groupByList([item('a', { list_id: 'l2' }), item('b', { list_id: 'l1' }), item('c', { list_id: 'l2' }), item('d', { list_id: 'zz' })], lists);
    expect(groups.map(g => g.list?.id)).toEqual(['l2', 'l1', undefined]);
    expect(groups[0].items.map(i => i.id)).toEqual(['a', 'c']);
  });
});

describe('resolveDrop', () => {
  const items = [
    item('b0', { column: 'backlog', order: 0 }),
    item('b1', { column: 'backlog', order: 1 }),
    item('w0', { column: 'this_week', order: 0 }),
    item('w1', { column: 'this_week', order: 1 }),
    item('d0', { column: 'today', completed: 1 }),
  ];
  const column = partition(items, { scope: 'all', completedMode: 'column' });
  const inline = partition(items, { scope: 'list', listId: 'l1', completedMode: 'inline' });

  it('over a column id appends to that column', () => {
    expect(resolveDrop({ activeId: 'b0', overId: 'this_week', items, partition: column })).toEqual({ kind: 'move', column: 'this_week', order: 2 });
  });

  it('over an item in the same column takes its index (excluding itself)', () => {
    expect(resolveDrop({ activeId: 'b0', overId: 'b1', items, partition: column })).toEqual({ kind: 'move', column: 'backlog', order: 0 });
    expect(resolveDrop({ activeId: 'b1', overId: 'b0', items, partition: column })).toEqual({ kind: 'move', column: 'backlog', order: 0 });
  });

  it('over an item in another column takes that index', () => {
    expect(resolveDrop({ activeId: 'b0', overId: 'w1', items, partition: column })).toEqual({ kind: 'move', column: 'this_week', order: 1 });
  });

  it('over Done (column or a done card) completes; a done item over Done is a no-op', () => {
    expect(resolveDrop({ activeId: 'b0', overId: 'done', items, partition: column })).toEqual({ kind: 'complete' });
    expect(resolveDrop({ activeId: 'b0', overId: 'd0', items, partition: column })).toEqual({ kind: 'complete' });
    expect(resolveDrop({ activeId: 'd0', overId: 'done', items, partition: column })).toBeNull();
  });

  it('a done item dragged into an active column uncompletes there', () => {
    expect(resolveDrop({ activeId: 'd0', overId: 'this_week', items, partition: column })).toEqual({ kind: 'uncomplete', column: 'this_week' });
    expect(resolveDrop({ activeId: 'd0', overId: 'b1', items, partition: column })).toEqual({ kind: 'uncomplete', column: 'backlog' });
  });

  it('self-drop and unknown targets are no-ops', () => {
    expect(resolveDrop({ activeId: 'b0', overId: 'b0', items, partition: column })).toBeNull();
    expect(resolveDrop({ activeId: 'b0', overId: 'nope', items, partition: column })).toBeNull();
    expect(resolveDrop({ activeId: 'nope', overId: 'today', items, partition: column })).toBeNull();
  });

  it('list scope: completed items are excluded from the index (inline mode)', () => {
    // d0 is completed inline in today; dropping onto today appends after the open cards only
    expect(resolveDrop({ activeId: 'b0', overId: 'today', items, partition: inline })).toEqual({ kind: 'move', column: 'today', order: 0 });
    // over a completed inline card in today: target column today, index falls back to open length
    expect(resolveDrop({ activeId: 'b0', overId: 'd0', items, partition: inline })).toEqual({ kind: 'move', column: 'today', order: 0 });
  });
});

describe('arrowTargets', () => {
  it('follows the data order', () => {
    expect(arrowTargets('backlog')).toEqual({ left: null, right: 'this_week' });
    expect(arrowTargets('this_week')).toEqual({ left: 'backlog', right: 'today' });
    expect(arrowTargets('today')).toEqual({ left: 'this_week', right: null });
  });
});

describe('listSubtitle', () => {
  it('logs to <id> | billable | not billable', () => {
    expect(listSubtitle(list('a', { task_id: '679834' }))).toBe('logs to 679834');
    expect(listSubtitle(list('a', { billable: 1 }))).toBe('billable');
    expect(listSubtitle(list('a', { billable: 0 }))).toBe('not billable');
  });
});

describe('provenance', () => {
  it('parses the Leexi prefix', () => {
    expect(provenance(item('a', { description: 'From Leexi call: KKS sync (Wed 23 Sep)\nhttps://app.leexi.ai/calls/x' }))).toEqual({ kind: 'leexi', date: 'Wed 23 Sep' });
  });
  it('returns null for other or malformed descriptions', () => {
    expect(provenance(item('a', { description: null }))).toBeNull();
    expect(provenance(item('a', { description: 'Just notes' }))).toBeNull();
    expect(provenance(item('a', { description: 'From Leexi call: no date' }))).toBeNull();
    expect(provenance(item('a', { description: 'From Leexi call: x ()' }))).toBeNull();
  });
});

describe('capacityLine', () => {
  it('formats focus against the 6h target', () => {
    expect(capacityLine(185)).toBe('3h 05m / 6h focus');
    expect(capacityLine(0)).toBe('0m / 6h focus');
    expect(capacityLine(360)).toBe('6h / 6h focus');
    expect(capacityLine(400)).toBe('6h 40m / 6h focus');
  });
  it('formatMinutesPadded', () => {
    expect(formatMinutesPadded(75)).toBe('1h 15m');
    expect(formatMinutesPadded(120)).toBe('2h');
    expect(formatMinutesPadded(25)).toBe('25m');
  });
});

describe('weekLabel / weekRange', () => {
  it('2026-09-25 is Week 39 · 21–27 Sep', () => {
    expect(weekLabel(new Date(2026, 8, 25))).toBe('Week 39 · 21–27 Sep');
    expect(isoWeek(new Date(2026, 8, 25))).toBe(39);
  });
  it('cross-month week shows both months', () => {
    expect(weekLabel(new Date(2026, 9, 1))).toBe('Week 40 · 28 Sep – 4 Oct');
  });
  it('cross-year week', () => {
    expect(weekLabel(new Date(2026, 11, 31))).toBe('Week 53 · 28 Dec – 3 Jan');
    expect(weekLabel(new Date(2027, 0, 4))).toBe('Week 1 · 4–10 Jan');
  });
  it('weekRange is Monday–Sunday', () => {
    expect(weekRange(new Date(2026, 8, 25))).toEqual({ from: '2026-09-21', to: '2026-09-27' });
    expect(weekRange(new Date(2026, 8, 27))).toEqual({ from: '2026-09-21', to: '2026-09-27' }); // Sunday
    expect(weekRange(new Date(2026, 8, 21))).toEqual({ from: '2026-09-21', to: '2026-09-27' }); // Monday
  });
});

describe('startCandidate', () => {
  const lists = [list('l1'), list('bound', { task_id: '689742' })];
  it('skips items without an effective id and respects order', () => {
    const c = startCandidate([item('b', { order: 1, task_id: '2' }), item('a', { order: 0 }), item('c', { order: 2, task_id: '3' })], lists);
    expect(c?.item.id).toBe('b');
    expect(c?.taskId).toBe('2');
  });
  it('honours the list id', () => {
    const c = startCandidate([item('x', { list_id: 'bound', task_id: '1' })], lists);
    expect(c?.taskId).toBe('689742');
  });
  it('returns null with nothing startable', () => {
    expect(startCandidate([item('a')], lists)).toBeNull();
    expect(startCandidate([], lists)).toBeNull();
  });
});

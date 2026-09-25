import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useListsStore } from './listsStore';
import type { ListItem } from '../types';

function item(id: string, overrides: Partial<ListItem> = {}): ListItem {
  return {
    id, list_id: 'l1', title: id, task_id: null, column: 'backlog', order: 0, completed: 0,
    archived: 0, completed_at: null, description: null, subtasks: '[]', billable: 1, created_at: '', ...overrides,
  };
}

const flush = () => new Promise(r => setTimeout(r, 0));

describe('listsStore', () => {
  beforeEach(() => {
    useListsStore.setState({ lists: [], archivedLists: [], items: [], selectedListId: null });
  });

  it('selectList sets the selection and reloads every list, not just the selected one', async () => {
    useListsStore.getState().selectList('l1');
    await flush();
    expect(useListsStore.getState().selectedListId).toBe('l1');
    expect(window.listsAPI.getAllListItems).toHaveBeenCalledTimes(1);
    expect(window.listsAPI.getListItems).not.toHaveBeenCalled();
  });

  it('loadItems archives old completed items before fetching, and a throwing archive does not block the load', async () => {
    const order: string[] = [];
    window.listsAPI.archiveOldCompleted = vi.fn(async () => { order.push('archive'); throw new Error('boom'); });
    window.listsAPI.getAllListItems = vi.fn(async () => { order.push('fetch'); return [item('a')]; });
    await useListsStore.getState().loadItems();
    expect(order).toEqual(['archive', 'fetch']);
    expect(useListsStore.getState().items.map(i => i.id)).toEqual(['a']);
  });

  it('createItem inserts optimistically, then persists and reloads all items', async () => {
    let resolveCreate: (v: string) => void = () => {};
    window.listsAPI.createListItem = vi.fn(() => new Promise<string>(r => { resolveCreate = r; }));
    window.listsAPI.getAllListItems = vi.fn(async () => [item('real')]);
    const { id: _id, created_at: _c, ...draft } = item('draft', { list_id: 'l2' });
    const p = useListsStore.getState().createItem(draft);
    expect(useListsStore.getState().items.some(i => i.id.startsWith('temp-'))).toBe(true);
    resolveCreate('real');
    await p;
    expect(window.listsAPI.getAllListItems).toHaveBeenCalled();
    expect(useListsStore.getState().items.map(i => i.id)).toEqual(['real']);
  });

  it('createItem failure removes the temporary row', async () => {
    window.listsAPI.createListItem = vi.fn(async () => { throw new Error('nope'); });
    const { id: _id, created_at: _c, ...draft } = item('draft');
    await useListsStore.getState().createItem(draft);
    expect(useListsStore.getState().items).toEqual([]);
  });

  it('moveItem updates optimistically and reloads on failure', async () => {
    useListsStore.setState({ items: [item('a')] });
    window.listsAPI.updateListItem = vi.fn(async () => { throw new Error('nope'); });
    window.listsAPI.getAllListItems = vi.fn(async () => [item('a', { column: 'backlog', order: 0 })]);
    const p = useListsStore.getState().moveItem('a', 'today', 3);
    expect(useListsStore.getState().items[0]).toMatchObject({ column: 'today', order: 3 });
    await p;
    expect(window.listsAPI.getAllListItems).toHaveBeenCalled();
    expect(useListsStore.getState().items[0]).toMatchObject({ column: 'backlog', order: 0 });
  });

  it('openCountByList / openCountAll ignore completed and archived items', () => {
    useListsStore.setState({
      items: [
        item('a', { list_id: 'l1' }),
        item('b', { list_id: 'l1', completed: 1 }),
        item('c', { list_id: 'l1', archived: 1 }),
        item('d', { list_id: 'l2' }),
        item('e', { list_id: 'l2' }),
      ],
    });
    expect(useListsStore.getState().openCountByList()).toEqual({ l1: 1, l2: 2 });
    expect(useListsStore.getState().openCountAll()).toBe(3);
  });
});

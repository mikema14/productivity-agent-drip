import { create } from 'zustand';
import type { TaskList, ListItem, ListItemColumn } from '../types';

interface ListsState {
  lists: TaskList[];
  archivedLists: TaskList[];
  items: ListItem[];
  selectedListId: string | null;
  loading: boolean;
  showArchivedLists: boolean;

  loadLists: () => Promise<void>;
  loadItems: (listId?: string) => Promise<void>;
  createList: (list: Omit<TaskList, 'id' | 'created_at'>) => Promise<string>;
  updateList: (id: string, updates: Partial<TaskList>) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  archiveList: (id: string) => Promise<void>;
  unarchiveList: (id: string) => Promise<void>;
  toggleShowArchivedLists: () => void;
  selectList: (id: string | null) => void;
  createItem: (item: Omit<ListItem, 'id' | 'created_at'>) => Promise<void>;
  updateItem: (id: string, updates: Partial<ListItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  moveItem: (id: string, column: ListItemColumn, order: number) => Promise<void>;
  getItemsByColumn: (listId: string, column: ListItemColumn) => ListItem[];
  getTodayItemsAllLists: () => ListItem[];
}

export const useListsStore = create<ListsState>((set, get) => ({
  lists: [],
  archivedLists: [],
  items: [],
  selectedListId: null,
  loading: false,
  showArchivedLists: false,

  loadLists: async () => {
    set({ loading: true });
    try {
      const lists = await window.listsAPI.getLists();
      const archivedLists = await window.listsAPI.getArchivedLists();
      set({ lists, archivedLists });
    } catch (error) {
      console.error('Failed to load lists:', error);
    } finally {
      set({ loading: false });
    }
  },

  loadItems: async (listId?: string) => {
    try {
      // Auto-archive old completed items
      try { await window.listsAPI.archiveOldCompleted(); } catch {}

      const items = listId
        ? await window.listsAPI.getListItems(listId)
        : await window.listsAPI.getAllListItems();
      set({ items });
    } catch (error) {
      console.error('Failed to load list items:', error);
    }
  },

  createList: async (list) => {
    const id = await window.listsAPI.createList(list);
    await get().loadLists();
    return id;
  },

  updateList: async (id, updates) => {
    await window.listsAPI.updateList(id, updates);
    await get().loadLists();
  },

  deleteList: async (id) => {
    await window.listsAPI.deleteList(id);
    const { selectedListId } = get();
    if (selectedListId === id) set({ selectedListId: null });
    await get().loadLists();
    await get().loadItems();
  },

  archiveList: async (id) => {
    await window.listsAPI.archiveList(id);
    const { selectedListId } = get();
    if (selectedListId === id) set({ selectedListId: null });
    await get().loadLists();
  },

  unarchiveList: async (id) => {
    await window.listsAPI.unarchiveList(id);
    await get().loadLists();
  },

  toggleShowArchivedLists: () => {
    set(s => ({ showArchivedLists: !s.showArchivedLists }));
  },

  selectList: (id) => {
    set({ selectedListId: id });
    if (id) get().loadItems(id);
  },

  createItem: async (item) => {
    await window.listsAPI.createListItem(item);
    await get().loadItems(item.list_id);
  },

  updateItem: async (id, updates) => {
    await window.listsAPI.updateListItem(id, updates);
    const { selectedListId } = get();
    await get().loadItems(selectedListId || undefined);
  },

  deleteItem: async (id) => {
    await window.listsAPI.deleteListItem(id);
    const { selectedListId } = get();
    await get().loadItems(selectedListId || undefined);
  },

  moveItem: async (id, column, order) => {
    await window.listsAPI.updateListItem(id, { column, order });
    const { selectedListId } = get();
    await get().loadItems(selectedListId || undefined);
  },

  getItemsByColumn: (listId, column) => {
    return get().items
      .filter(i => i.list_id === listId && i.column === column && !i.archived)
      .sort((a, b) => a.order - b.order);
  },

  getTodayItemsAllLists: () => {
    return get().items
      .filter(i => i.column === 'today' && !i.archived)
      .sort((a, b) => a.order - b.order);
  },
}));

import { useEffect, useState } from 'react';
import { useListsStore } from '../../stores/listsStore';
import DraggableItem from './DraggableItem';
import TaskDetailInline from './TaskDetailInline';
import TaskIdBadge from '../shared/TaskIdBadge';
import { resolveTaskNames } from '../../hooks/useTaskName';
import type { ListItemColumn, ListItem, Subtask } from '../../types';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';

type AllColumn = ListItemColumn | 'done';

const ALL_COLUMNS: { key: AllColumn; label: string }[] = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'this_week', label: 'This Week' },
  { key: 'today', label: 'Today' },
  { key: 'done', label: 'Done' },
];

const ACTIVE_COLUMNS: ListItemColumn[] = ['backlog', 'this_week', 'today'];

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef} className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 min-h-[60px]">{children}</div>;
}

export default function AllListsOverview() {
  const { lists, items, loadLists, loadItems, updateItem, moveItem } = useListsStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [expandedChecklistId, setExpandedChecklistId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState<boolean>(() =>
    localStorage.getItem('allListsOverview_showDone') !== 'false'
  );
  const [activeListFilters, setActiveListFilters] = useState<Set<string>>(new Set());
  const [groupByList, setGroupByList] = useState<boolean>(false);
  const [openListPickerId, setOpenListPickerId] = useState<string | null>(null);
  const [taskNames, setTaskNames] = useState<Record<string, string>>({});
  const [showTaskIds, setShowTaskIds] = useState<boolean>(() =>
    localStorage.getItem('allListsOverview_showTaskIds') === 'true'
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    loadLists();
    loadItems();
  }, []);

  useEffect(() => {
    const ids = items.filter(i => i.task_id && !taskNames[i.task_id]).map(i => i.task_id!);
    if (ids.length === 0) return;
    resolveTaskNames([...new Set(ids)]).then(names => {
      if (Object.keys(names).length > 0) setTaskNames(prev => ({ ...prev, ...names }));
    });
  }, [items]);

  // Close list picker on outside click
  useEffect(() => {
    if (!openListPickerId) return;
    const handler = () => setOpenListPickerId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openListPickerId]);

  const getItemsForAllColumn = (col: AllColumn): ListItem[] => {
    const filterActive = activeListFilters.size > 0;
    if (col === 'done') {
      return items
        .filter(i => i.completed === 1 && !i.archived && (!filterActive || activeListFilters.has(i.list_id)))
        .sort((a, b) => a.order - b.order);
    }
    return items
      .filter(i => i.column === col && i.completed === 0 && !i.archived && (!filterActive || activeListFilters.has(i.list_id)))
      .sort((a, b) => a.order - b.order);
  };

  const getListForItem = (item: ListItem) => lists.find(l => l.id === item.list_id);

  const getSubtaskCount = (item: ListItem): { done: number; total: number } | null => {
    try {
      const subtasks: Subtask[] = JSON.parse(item.subtasks || '[]');
      if (subtasks.length === 0) return null;
      return { done: subtasks.filter(s => s.completed).length, total: subtasks.length };
    } catch { return null; }
  };

  const findColumnForItem = (itemId: string): AllColumn | null => {
    const item = items.find(i => i.id === itemId);
    if (!item) return null;
    return item.completed === 1 ? 'done' : item.column;
  };

  const handleToggleListFilter = (listId: string) => {
    setActiveListFilters(prev => {
      const next = new Set(prev);
      next.has(listId) ? next.delete(listId) : next.add(listId);
      return next;
    });
  };

  const handleMoveToList = (itemId: string, newListId: string) => {
    updateItem(itemId, { list_id: newListId });
    setOpenListPickerId(null);
  };

  const handleColumnMove = (item: ListItem, direction: 'left' | 'right') => {
    if (item.completed === 1) return;
    const colIndex = ACTIVE_COLUMNS.indexOf(item.column);
    const newIndex = direction === 'left' ? colIndex - 1 : colIndex + 1;
    if (newIndex < 0 || newIndex >= ACTIVE_COLUMNS.length) return;
    const targetColumn = ACTIVE_COLUMNS[newIndex];
    moveItem(item.id, targetColumn, getItemsForAllColumn(targetColumn).length);
  };

  const handleToggleDone = () => {
    setShowDone(prev => {
      const next = !prev;
      localStorage.setItem('allListsOverview_showDone', String(next));
      return next;
    });
  };

  const handleToggleTaskIds = () => {
    setShowTaskIds(prev => {
      const next = !prev;
      localStorage.setItem('allListsOverview_showTaskIds', String(next));
      return next;
    });
  };

  const getGroupedItems = (columnItems: ListItem[]) => {
    const groups = new Map<string, ListItem[]>();
    for (const item of columnItems) {
      const existing = groups.get(item.list_id) || [];
      groups.set(item.list_id, [...existing, item]);
    }
    return Array.from(groups.entries()).map(([listId, groupItems]) => ({
      list: lists.find(l => l.id === listId),
      items: groupItems,
    }));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeItemId = active.id as string;
    const overId = over.id as string;
    const item = items.find(i => i.id === activeItemId);
    if (!item) return;

    const targetCol: AllColumn = ALL_COLUMNS.find(c => c.key === overId)?.key || findColumnForItem(overId) || 'backlog';

    if (targetCol === 'done') {
      updateItem(activeItemId, { completed: 1 });
    } else {
      const wasCompleted = item.completed === 1;
      if (wasCompleted) {
        updateItem(activeItemId, { completed: 0, column: targetCol });
      } else {
        const targetItems = getItemsForAllColumn(targetCol).filter(i => i.id !== activeItemId);
        const overIndex = targetItems.findIndex(i => i.id === overId);
        const newOrder = overIndex >= 0 ? overIndex : targetItems.length;
        moveItem(activeItemId, targetCol as ListItemColumn, newOrder);
      }
    }
  };

  const activeItem = activeId ? items.find(i => i.id === activeId) : null;
  const activeItemList = activeItem ? getListForItem(activeItem) : null;

  const renderItem = (item: ListItem, key: AllColumn) => {
    const list = getListForItem(item);
    const subtaskCount = getSubtaskCount(item);
    const isCompleted = item.completed === 1;

    return (
      <DraggableItem key={item.id} id={item.id}>
        <div className={`group relative flex items-start gap-2 px-3 py-2 rounded-xl hover:bg-focus/5 transition-colors ${isCompleted ? 'opacity-50' : ''}`}>
          {/* Checkbox */}
          <button
            onClick={(e) => { e.stopPropagation(); updateItem(item.id, { completed: isCompleted ? 0 : 1 }); }}
            className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
              isCompleted ? 'border-transparent' : 'border-focus/20 hover:border-focus/50'
            }`}
            style={isCompleted && list ? { backgroundColor: list.color } : undefined}
          >
            {item.completed === 1 && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 5l2.5 2.5L8 3" />
              </svg>
            )}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <button
              onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
              className={`text-sm text-left transition-colors w-full ${isCompleted ? 'text-txt-muted line-through' : 'text-txt-primary hover:text-focus'}`}
            >
              {item.title}
            </button>
            {showTaskIds && item.task_id && (
              <TaskIdBadge
                taskId={item.task_id}
                taskName={taskNames[item.task_id] || null}
                className="ml-1 text-xs text-focus/70 bg-focus/5 px-1.5 py-0.5 rounded"
              />
            )}

            {/* List tag — only in flat view */}
            {!groupByList && list && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: list.color }} />
                <span className="text-xs text-txt-dim">{list.name}</span>
              </div>
            )}

            {/* Subtask badge */}
            {subtaskCount && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpandedChecklistId(expandedChecklistId === item.id ? null : item.id); }}
                className="flex items-center gap-1 text-xs text-txt-muted hover:text-txt-secondary transition-colors mt-0.5"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                  className={`transition-transform duration-150 ${expandedChecklistId === item.id ? 'rotate-90' : ''}`}
                >
                  <path d="M3 1.5l4 3.5-4 3.5" />
                </svg>
                {subtaskCount.done}/{subtaskCount.total} subtasks
              </button>
            )}
          </div>

          {/* Hover actions */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity duration-150">
            {/* Left arrow */}
            {!isCompleted && key !== 'backlog' && key !== 'done' && (
              <button
                onClick={(e) => { e.stopPropagation(); handleColumnMove(item, 'left'); }}
                className="p-1 text-txt-muted hover:text-txt-secondary transition-colors"
                title="Move left"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M7 3L4 6l3 3" />
                </svg>
              </button>
            )}
            {/* Right arrow */}
            {!isCompleted && key !== 'today' && key !== 'done' && (
              <button
                onClick={(e) => { e.stopPropagation(); handleColumnMove(item, 'right'); }}
                className="p-1 text-txt-muted hover:text-txt-secondary transition-colors"
                title="Move right"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M5 3l3 3-3 3" />
                </svg>
              </button>
            )}

            {/* Move to list */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenListPickerId(openListPickerId === item.id ? null : item.id); }}
                className="p-1 text-txt-muted hover:text-txt-secondary transition-colors"
                title="Move to list"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 3a1 1 0 011-1h2.5L5.5 3.5H10a1 1 0 011 1v5a1 1 0 01-1 1H2a1 1 0 01-1-1V3z" />
                </svg>
              </button>

              {openListPickerId === item.id && (
                <div className="absolute right-0 top-7 z-50 bg-drip-elevated border border-focus/20 rounded-xl shadow-xl py-1 min-w-[160px] animate-fade-in">
                  {lists.map(l => (
                    <button
                      key={l.id}
                      onClick={(e) => { e.stopPropagation(); handleMoveToList(item.id, l.id); }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-focus/10 ${
                        l.id === item.list_id ? 'text-focus' : 'text-txt-secondary'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                      {l.name}
                      {l.id === item.list_id && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="ml-auto">
                          <path d="M2 5l2 2 4-4" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TaskDetailInline expansion */}
        {expandedItemId === item.id && (
          <TaskDetailInline
            item={item}
            listColor={list?.color || '#f59e0b'}
            isFolderList={!list?.task_id}
            onUpdate={updateItem}
            onClose={() => setExpandedItemId(null)}
          />
        )}

        {/* Inline checklist — lightweight, only when not in full expand */}
        {expandedChecklistId === item.id && expandedItemId !== item.id && (() => {
          try {
            const subs: Subtask[] = JSON.parse(item.subtasks || '[]');
            if (subs.length === 0) return null;
            return (
              <div className="ml-6 mb-1 pl-2 border-l-2 space-y-0.5 animate-fade-in" style={{ borderColor: list?.color || '#f59e0b' }}>
                {subs.map(s => (
                  <div key={s.id} className="flex items-center gap-2 py-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const updated = subs.map(x => x.id === s.id ? { ...x, completed: !x.completed } : x);
                        updateItem(item.id, { subtasks: JSON.stringify(updated) });
                      }}
                      className={`w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                        s.completed ? 'border-transparent' : 'border-focus/20'
                      }`}
                      style={s.completed ? { backgroundColor: list?.color || '#f59e0b' } : undefined}
                    >
                      {s.completed && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M1.5 4l1.5 1.5L6.5 2.5" />
                        </svg>
                      )}
                    </button>
                    <span className={`text-xs ${s.completed ? 'text-txt-muted line-through' : 'text-txt-secondary'}`}>{s.title}</span>
                  </div>
                ))}
              </div>
            );
          } catch { return null; }
        })()}
      </DraggableItem>
    );
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="px-8 pt-8 pb-4">
        {/* Title row — toggles anchored right, never wrap */}
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-2xl font-display font-bold text-txt-primary tracking-tight">All Tasks</h1>
          <div className="h-px flex-1 bg-gradient-to-r from-focus/20 to-transparent" />
          <p className="text-txt-dim text-sm font-display shrink-0">
            {items.filter(i => i.completed === 0 && !i.archived).length} remaining across {lists.length} lists
          </p>
          {/* Group by list toggle */}
          <button
            onClick={() => setGroupByList(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display transition-colors shrink-0 ${
              groupByList
                ? 'bg-focus/15 text-txt-primary border border-focus/30'
                : 'bg-drip-surface text-txt-muted hover:text-txt-secondary hover:bg-focus/5'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4l5 2.5L11 4M1 4L6 1.5 11 4" />
              <path d="M1 8l5 2.5L11 8" />
            </svg>
            Group
          </button>
          {/* Done column toggle */}
          <button
            onClick={handleToggleDone}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display transition-colors shrink-0 ${
              showDone
                ? 'bg-focus/15 text-txt-primary border border-focus/30'
                : 'bg-drip-surface text-txt-muted hover:text-txt-secondary hover:bg-focus/5'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="6" cy="6" r="5" />
              <path d="M3.5 6l1.5 1.5L8.5 4" />
            </svg>
            Done
          </button>
          {/* Task IDs toggle */}
          <button
            onClick={handleToggleTaskIds}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display transition-colors shrink-0 ${
              showTaskIds
                ? 'bg-focus/15 text-txt-primary border border-focus/30'
                : 'bg-drip-surface text-txt-muted hover:text-txt-secondary hover:bg-focus/5'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 1v10M8 1v10M1 4h10M1 8h10" />
            </svg>
            IDs
          </button>
        </div>

        {/* Filter pills row — wraps freely without displacing toggles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveListFilters(new Set())}
            className={`px-2.5 py-1 rounded-full text-xs font-display transition-colors ${
              activeListFilters.size === 0
                ? 'bg-focus text-drip-bg'
                : 'bg-drip-surface text-txt-muted hover:text-txt-secondary hover:bg-focus/10'
            }`}
          >
            All
          </button>
          {lists.map(list => (
            <button
              key={list.id}
              onClick={() => handleToggleListFilter(list.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-display transition-colors ${
                activeListFilters.has(list.id)
                  ? 'bg-focus/15 text-txt-primary border border-focus/30'
                  : 'bg-drip-surface text-txt-muted hover:text-txt-secondary hover:bg-focus/10'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: list.color }} />
              {list.name}
            </button>
          ))}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 flex gap-4 p-4 overflow-x-auto">
          {ALL_COLUMNS.filter(c => c.key !== 'done' || showDone).map(({ key, label }) => {
            const columnItems = getItemsForAllColumn(key);
            return (
              <div key={key} className="flex-1 min-w-[220px] bg-drip-surface rounded-2xl border border-focus/30 flex flex-col">
                <div className="p-4 pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-display font-semibold text-txt-primary">{label}</h2>
                    <span className="text-xs text-txt-muted font-mono">{columnItems.length}</span>
                  </div>
                </div>
                <SortableContext items={columnItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <DroppableColumn id={key}>
                    {groupByList
                      ? getGroupedItems(columnItems).map(({ list: groupList, items: groupItems }) => (
                          <div key={groupList?.id || 'unknown'} className="mb-2">
                            <div className="flex items-center gap-1.5 px-3 py-1 mb-0.5">
                              {groupList && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: groupList.color }} />}
                              <span className="text-xs font-display font-medium text-txt-muted uppercase tracking-wider">
                                {groupList?.name || 'Unknown List'}
                              </span>
                              <span className="text-xs text-txt-dim font-mono ml-1">{groupItems.length}</span>
                            </div>
                            {groupItems.map(item => renderItem(item, key))}
                          </div>
                        ))
                      : columnItems.map(item => renderItem(item, key))
                    }
                    {columnItems.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-txt-muted">
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="mb-2 text-txt-dim">
                          <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M9 14l3.5 3.5L19 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-xs">All Clear</span>
                      </div>
                    )}
                  </DroppableColumn>
                </SortableContext>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeItem && (
            <div className="px-3 py-2 rounded-xl bg-drip-elevated border border-focus/30 shadow-lg scale-[1.02] opacity-90 flex items-center gap-2">
              {activeItemList && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeItemList.color }} />}
              <span className="text-sm text-txt-primary">{activeItem.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

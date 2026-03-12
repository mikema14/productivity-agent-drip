import { useEffect, useState } from 'react';
import { useListsStore } from '../../stores/listsStore';
import { useTaskName, resolveTaskNames } from '../../hooks/useTaskName';
import AddItemInline from './AddItemInline';
import DraggableItem from './DraggableItem';
import TaskDetailInline from './TaskDetailInline';
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

const COLUMNS: { key: ListItemColumn; label: string }[] = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'this_week', label: 'This Week' },
  { key: 'today', label: 'Today' },
];

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef} className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 min-h-[60px]">{children}</div>;
}

export default function ListPlanningView() {
  const {
    lists,
    items,
    selectedListId,
    loadLists,
    loadItems,
    selectList,
    createItem,
    updateItem,
    deleteItem,
    moveItem,
    getItemsByColumn,
  } = useListsStore();

  const [addingColumn, setAddingColumn] = useState<ListItemColumn | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [expandedChecklistId, setExpandedChecklistId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [taskNames, setTaskNames] = useState<Record<string, string>>({});

  const selectedList = lists.find(l => l.id === selectedListId);
  const listTaskName = useTaskName(selectedList?.task_id || null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => { loadLists(); }, []);
  useEffect(() => { if (selectedListId) loadItems(selectedListId); }, [selectedListId]);
  useEffect(() => { if (!selectedListId && lists.length > 0) selectList(lists[0].id); }, [lists, selectedListId]);

  // Resolve item task IDs to names for tooltips
  useEffect(() => {
    const ids = items.filter(i => i.task_id && !taskNames[i.task_id]).map(i => i.task_id!);
    if (ids.length === 0) return;
    resolveTaskNames([...new Set(ids)]).then(names => {
      if (Object.keys(names).length > 0) setTaskNames(prev => ({ ...prev, ...names }));
    });
  }, [items]);

  const handleAddItem = async (column: ListItemColumn, title: string, taskId: string | null) => {
    if (!selectedListId) return;
    const columnItems = getItemsByColumn(selectedListId, column);
    await createItem({
      list_id: selectedListId,
      title,
      task_id: taskId,
      column,
      order: columnItems.length,
      completed: 0,
      archived: 0,
      completed_at: null,
      description: null,
      subtasks: '[]',
    });
  };

  const handleToggleComplete = async (item: ListItem) => {
    await updateItem(item.id, { completed: item.completed ? 0 : 1 });
  };

  const handleMoveItem = async (item: ListItem, direction: 'left' | 'right') => {
    const colIndex = COLUMNS.findIndex(c => c.key === item.column);
    const newIndex = direction === 'left' ? colIndex - 1 : colIndex + 1;
    if (newIndex < 0 || newIndex >= COLUMNS.length) return;
    const targetColumn = COLUMNS[newIndex].key;
    const targetItems = selectedListId ? getItemsByColumn(selectedListId, targetColumn) : [];
    await moveItem(item.id, targetColumn, targetItems.length);
  };

  // DnD: find which column an item belongs to
  const findColumnForItem = (itemId: string): ListItemColumn | null => {
    const item = items.find(i => i.id === itemId);
    return item ? item.column : null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !selectedListId) return;

    const activeItemId = active.id as string;
    const overId = over.id as string;

    // Determine target column: either the column itself or the column of the item we're over
    let targetColumn = COLUMNS.find(c => c.key === overId)?.key || findColumnForItem(overId);
    if (!targetColumn) return;

    const targetItems = getItemsByColumn(selectedListId, targetColumn).filter(i => i.id !== activeItemId && !i.completed);
    const overIndex = targetItems.findIndex(i => i.id === overId);
    const newOrder = overIndex >= 0 ? overIndex : targetItems.length;

    moveItem(activeItemId, targetColumn, newOrder);
  };

  const handleArchiveList = async () => {
    if (!selectedListId) return;
    if (confirm('Archive this list? It will be hidden from the sidebar.')) {
      await window.listsAPI.archiveList(selectedListId);
      await loadLists();
    }
  };

  const activeItem = activeId ? items.find(i => i.id === activeId) : null;

  if (!selectedList) {
    return (
      <div className="flex items-center justify-center h-full text-txt-muted animate-fade-in">
        <div className="text-center space-y-2">
          <p className="text-lg font-display">No list selected</p>
          <p className="text-sm">Create a list from the sidebar to get started.</p>
        </div>
      </div>
    );
  }

  const isFolderList = !selectedList.task_id;

  const getSubtaskCount = (item: ListItem): { done: number; total: number } | null => {
    try {
      const subtasks: Subtask[] = JSON.parse(item.subtasks || '[]');
      if (subtasks.length === 0) return null;
      return { done: subtasks.filter(s => s.completed).length, total: subtasks.length };
    } catch { return null; }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="px-6 py-4 border-b border-glass-border flex items-center gap-3">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedList.color }} />
        <h1 className="text-xl font-display font-semibold text-txt-primary">{selectedList.name}</h1>
        {selectedList.task_id && (
          <span className="font-mono text-sm text-focus bg-focus-muted px-2.5 py-0.5 rounded-full cursor-help" title={listTaskName || ''}>
            #{selectedList.task_id}
          </span>
        )}
        <span className="text-sm text-txt-muted ml-auto">
          {items.filter(i => i.list_id === selectedListId && !i.archived).length === 0
            ? 'This list has no tasks'
            : `${items.filter(i => i.list_id === selectedListId && !i.completed && !i.archived).length} remaining`}
        </span>
        <button
          onClick={handleArchiveList}
          className="p-1.5 text-txt-muted hover:text-txt-secondary transition-colors rounded-lg hover:bg-glass-hover"
          title="Archive list"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="2" width="14" height="4" rx="1" />
            <path d="M2 6v7a1 1 0 001 1h10a1 1 0 001-1V6" />
            <path d="M6 9h4" />
          </svg>
        </button>
      </div>

      {/* Columns with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex gap-4 p-4 overflow-x-auto">
          {COLUMNS.map(({ key, label }) => {
            const columnItems = selectedListId ? getItemsByColumn(selectedListId, key) : [];
            const activeItems = columnItems.filter(i => !i.completed && !i.archived);
            const completedItems = columnItems.filter(i => i.completed && !i.archived);
            const doneCount = completedItems.length;
            const totalCount = columnItems.filter(i => !i.archived).length;
            const progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

            return (
              <div key={key} className="flex-1 min-w-[240px] bg-drip-surface rounded-2xl border border-glass-border flex flex-col">
                {/* Column header */}
                <div className="p-4 pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-display font-semibold text-txt-primary">{label}</h2>
                    {totalCount > 0 && (
                      <span className="text-xs text-txt-muted">{doneCount}/{totalCount} Done</span>
                    )}
                  </div>
                  {totalCount > 0 && (
                    <div className="h-1 rounded-full bg-glass-bg overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${progressPct}%`, backgroundColor: selectedList.color }}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => setAddingColumn(addingColumn === key ? null : key)}
                    className="mt-3 flex items-center gap-1.5 text-txt-muted hover:text-txt-secondary transition-colors text-xs uppercase tracking-wider"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <line x1="7" y1="3" x2="7" y2="11" />
                      <line x1="3" y1="7" x2="11" y2="7" />
                    </svg>
                    Add Task
                  </button>
                </div>

                {addingColumn === key && (
                  <div className="px-4 pb-2">
                    <AddItemInline
                      listId={selectedListId!}
                      column={key}
                      showTaskId={isFolderList}
                      onAdd={(title, taskId) => handleAddItem(key, title, taskId)}
                      onCancel={() => setAddingColumn(null)}
                    />
                  </div>
                )}

                <SortableContext items={activeItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <DroppableColumn id={key}>
                    {activeItems.map(item => {
                      const subtaskCount = getSubtaskCount(item);
                      return (
                        <DraggableItem key={item.id} id={item.id}>
                          <div className="group flex items-start gap-2 px-3 py-2 rounded-xl hover:bg-glass-hover transition-colors">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleToggleComplete(item); }}
                              className="mt-0.5 w-4 h-4 rounded border border-glass-border hover:border-focus/50 flex-shrink-0 transition-colors"
                            />
                            <div className="flex-1 min-w-0">
                              <button
                                onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                                className="text-sm text-txt-primary hover:text-focus transition-colors text-left"
                              >
                                {item.title}
                              </button>
                              {item.task_id && (
                                <span className="ml-1.5 font-mono text-xs text-focus cursor-help" title={taskNames[item.task_id] || ''}>#{item.task_id}</span>
                              )}
                              {subtaskCount && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setExpandedChecklistId(expandedChecklistId === item.id ? null : item.id); }}
                                  className="ml-2 flex items-center gap-1 text-xs text-txt-muted hover:text-txt-secondary transition-colors"
                                >
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                                    className={`transition-transform duration-200 ${expandedChecklistId === item.id ? 'rotate-90' : ''}`}
                                  >
                                    <path d="M3 1.5l4 3.5-4 3.5" />
                                  </svg>
                                  {subtaskCount.done}/{subtaskCount.total} Subtasks
                                </button>
                              )}
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                              {key !== 'backlog' && (
                                <button onClick={(e) => { e.stopPropagation(); handleMoveItem(item, 'left'); }} className="p-1 text-txt-muted hover:text-txt-secondary" title="Move left">
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M7 3L4 6l3 3" /></svg>
                                </button>
                              )}
                              {key !== 'today' && (
                                <button onClick={(e) => { e.stopPropagation(); handleMoveItem(item, 'right'); }} className="p-1 text-txt-muted hover:text-txt-secondary" title="Move right">
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 3l3 3-3 3" /></svg>
                                </button>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} className="p-1 text-txt-muted hover:text-red-400" title="Delete">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l6 6M9 3l-6 6" /></svg>
                              </button>
                            </div>
                          </div>
                          {/* Task detail expansion */}
                          {expandedItemId === item.id && (
                            <TaskDetailInline
                              item={item}
                              listColor={selectedList.color}
                              isFolderList={isFolderList}
                              onUpdate={updateItem}
                              onClose={() => setExpandedItemId(null)}
                            />
                          )}
                          {/* Inline checklist toggle (lightweight) */}
                          {expandedChecklistId === item.id && expandedItemId !== item.id && (() => {
                            try {
                              const subs: Subtask[] = JSON.parse(item.subtasks || '[]');
                              if (subs.length === 0) return null;
                              return (
                                <div className="ml-6 mb-1 pl-2 border-l-2 space-y-0.5 animate-fade-in" style={{ borderColor: selectedList.color }}>
                                  {subs.map(s => (
                                    <div key={s.id} className="flex items-center gap-2 py-0.5">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const updated = subs.map(x => x.id === s.id ? { ...x, completed: !x.completed } : x);
                                          updateItem(item.id, { subtasks: JSON.stringify(updated) });
                                        }}
                                        className={`w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                                          s.completed ? 'border-transparent' : 'border-glass-border'
                                        }`}
                                        style={s.completed ? { backgroundColor: selectedList.color } : undefined}
                                      >
                                        {s.completed && (
                                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"><path d="M1.5 4l1.5 1.5L6.5 2.5" /></svg>
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
                    })}

                    {completedItems.map(item => (
                      <div key={item.id} className="group flex items-start gap-2 px-3 py-2 rounded-xl hover:bg-glass-hover transition-colors opacity-50">
                        <button
                          onClick={() => handleToggleComplete(item)}
                          className="mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center"
                          style={{ backgroundColor: selectedList.color }}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M2 5l2.5 2.5L8 3" />
                          </svg>
                        </button>
                        <span className="text-sm text-txt-muted line-through">{item.title}</span>
                      </div>
                    ))}

                    {totalCount === 0 && addingColumn !== key && (
                      <div className="flex flex-col items-center justify-center py-8 text-txt-muted">
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mb-2" style={{ color: selectedList.color }}>
                          <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M10 16l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-sm">All Clear</span>
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
            <div className="px-3 py-2 rounded-xl bg-drip-elevated border border-glass-border shadow-lg scale-[1.02] opacity-90">
              <span className="text-sm text-txt-primary">{activeItem.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useListsStore } from '../../stores/listsStore';
import DraggableItem from './DraggableItem';
import type { ListItemColumn, ListItem } from '../../types';
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

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef} className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 min-h-[60px]">{children}</div>;
}

export default function AllListsOverview() {
  const { lists, items, loadLists, loadItems, updateItem, moveItem } = useListsStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    loadLists();
    loadItems(); // all items
  }, []);

  const getItemsForAllColumn = (col: AllColumn): ListItem[] => {
    if (col === 'done') {
      return items.filter(i => i.completed && !i.archived).sort((a, b) => a.order - b.order);
    }
    return items.filter(i => i.column === col && !i.completed && !i.archived).sort((a, b) => a.order - b.order);
  };

  const getListForItem = (item: ListItem) => lists.find(l => l.id === item.list_id);

  const findColumnForItem = (itemId: string): AllColumn | null => {
    const item = items.find(i => i.id === itemId);
    if (!item) return null;
    return item.completed ? 'done' : item.column;
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

    let targetCol: AllColumn = ALL_COLUMNS.find(c => c.key === overId)?.key || findColumnForItem(overId) || 'backlog';

    if (targetCol === 'done') {
      // Move to done = complete the item
      updateItem(activeItemId, { completed: 1 });
    } else {
      const wasCompleted = item.completed;
      if (wasCompleted) {
        // Moving out of done = uncomplete
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

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="px-6 py-4 border-b border-glass-border">
        <h1 className="text-xl font-display font-semibold text-txt-primary">All Tasks</h1>
        <span className="text-sm text-txt-muted">
          {items.filter(i => !i.completed && !i.archived).length} remaining across {lists.length} lists
        </span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 flex gap-4 p-4 overflow-x-auto">
          {ALL_COLUMNS.map(({ key, label }) => {
            const columnItems = getItemsForAllColumn(key);
            return (
              <div key={key} className="flex-1 min-w-[220px] bg-drip-surface rounded-2xl border border-glass-border flex flex-col">
                <div className="p-4 pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-display font-semibold text-txt-primary">{label}</h2>
                    <span className="text-xs text-txt-muted">{columnItems.length}</span>
                  </div>
                </div>
                <SortableContext items={columnItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <DroppableColumn id={key}>
                    {columnItems.map(item => {
                      const list = getListForItem(item);
                      return (
                        <DraggableItem key={item.id} id={item.id}>
                          <div className={`flex items-start gap-2 px-3 py-2 rounded-xl hover:bg-glass-hover transition-colors ${item.completed ? 'opacity-50' : ''}`}>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateItem(item.id, { completed: item.completed ? 0 : 1 }); }}
                              className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                                item.completed ? 'border-transparent' : 'border-glass-border hover:border-focus/50'
                              }`}
                              style={item.completed && list ? { backgroundColor: list.color } : undefined}
                            >
                              {item.completed && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                                  <path d="M2 5l2.5 2.5L8 3" />
                                </svg>
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm ${item.completed ? 'text-txt-muted line-through' : 'text-txt-primary'}`}>{item.title}</span>
                              {list && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: list.color }} />
                                  <span className="text-xs text-txt-dim">{list.name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </DraggableItem>
                      );
                    })}
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
            <div className="px-3 py-2 rounded-xl bg-drip-elevated border border-glass-border shadow-lg scale-[1.02] opacity-90 flex items-center gap-2">
              {activeItemList && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeItemList.color }} />}
              <span className="text-sm text-txt-primary">{activeItem.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

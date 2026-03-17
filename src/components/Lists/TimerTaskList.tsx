import { useEffect, useState } from 'react';
import { useListsStore } from '../../stores/listsStore';
import { resolveTaskNames } from '../../hooks/useTaskName';
import TaskIdBadge from '../shared/TaskIdBadge';
import type { ListItemColumn, ListItem, TaskList, Subtask } from '../../types';

interface TimerTaskListProps {
  onSelectTask: (taskId: string | null, intention: string) => void;
}

const COLUMN_FILTERS: { key: ListItemColumn | 'all'; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'Week' },
  { key: 'all', label: 'All' },
];

export default function TimerTaskList({ onSelectTask }: TimerTaskListProps) {
  const { lists, items, loadLists, loadItems } = useListsStore();
  const [columnFilter, setColumnFilter] = useState<ListItemColumn | 'all'>('all');
  const [listFilter, setListFilter] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [taskNames, setTaskNames] = useState<Record<string, string>>({});

  const getSubtaskCount = (item: ListItem): { done: number; total: number } | null => {
    try {
      const subtasks: Subtask[] = JSON.parse(item.subtasks || '[]');
      if (subtasks.length === 0) return null;
      return { done: subtasks.filter(s => s.completed).length, total: subtasks.length };
    } catch { return null; }
  };

  useEffect(() => {
    loadLists();
    loadItems();
  }, []);

  // Resolve task IDs to names for tooltips
  useEffect(() => {
    const ids = new Set<string>();
    lists.forEach(l => { if (l.task_id && !taskNames[l.task_id]) ids.add(l.task_id); });
    items.forEach(i => { if (i.task_id && !taskNames[i.task_id]) ids.add(i.task_id); });
    if (ids.size === 0) return;
    resolveTaskNames([...ids]).then(names => {
      if (Object.keys(names).length > 0) setTaskNames(prev => ({ ...prev, ...names }));
    });
  }, [lists, items]);

  // Apply filter chain
  const filteredItems = items.filter(item => {
    if (item.archived) return false;
    if (columnFilter !== 'all' && item.column !== columnFilter) return false;
    if (listFilter && item.list_id !== listFilter) return false;
    if (!showCompleted && item.completed) return false;
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Group by list
  const groupedByList = lists
    .map(list => ({
      list,
      items: filteredItems.filter(i => i.list_id === list.id),
    }))
    .filter(g => g.items.length > 0);

  const activeGroups = groupedByList.map(g => ({
    ...g,
    active: g.items.filter(i => !i.completed),
    completed: g.items.filter(i => i.completed),
  }));

  const handleItemClick = (item: ListItem, list: TaskList) => {
    setSelectedItemId(item.id);
    let taskId: string | null = null;
    if (list.task_id) {
      taskId = list.task_id;
    } else if (item.task_id) {
      taskId = item.task_id;
    }
    onSelectTask(taskId, item.title);
  };

  const handleToggleComplete = async (e: React.MouseEvent, item: ListItem) => {
    e.stopPropagation();
    await window.listsAPI.updateListItem(item.id, { completed: item.completed ? 0 : 1 });
    await loadItems();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filters area */}
      <div className="px-4 pt-4 pb-3 space-y-3">
        {/* Segmented control for column filter */}
        <div className="bg-transparent rounded-xl p-0.5 border border-focus/30 flex">
          {COLUMN_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setColumnFilter(f.key)}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                columnFilter === f.key
                  ? 'bg-focus/15 text-focus'
                  : 'text-txt-muted hover:text-txt-secondary hover:bg-focus/5'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-dim">
            <circle cx="6" cy="6" r="4.5" />
            <path d="M9.5 9.5L13 13" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-9 pr-3 py-2 bg-transparent border border-focus/30 rounded-xl text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:ring-1 focus:ring-focus/30 transition-all"
          />
        </div>

        {/* List filter pills + show completed */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setListFilter(null)}
              className={`px-2.5 py-1 text-xs rounded-lg whitespace-nowrap transition-all ${
                !listFilter ? 'bg-focus/15 text-focus' : 'text-txt-muted hover:text-txt-secondary hover:bg-focus/5'
              }`}
            >
              All Lists
            </button>
            {lists.map(list => (
              <button
                key={list.id}
                onClick={() => setListFilter(listFilter === list.id ? null : list.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg whitespace-nowrap transition-all ${
                  listFilter === list.id ? 'bg-focus/15 text-focus' : 'text-txt-muted hover:text-txt-secondary hover:bg-focus/5'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: list.color }} />
                {list.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={`flex-shrink-0 px-2 py-1 text-xs rounded-lg transition-all ${
              showCompleted ? 'bg-focus/10 text-focus' : 'text-txt-dim hover:text-txt-muted'
            }`}
            title="Show completed"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 7l3 3 5-5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {activeGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-txt-muted">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mb-3 text-txt-dim">
              <rect x="8" y="6" width="32" height="36" rx="4" stroke="currentColor" strokeWidth="1.5" />
              <path d="M16 18h16M16 24h12M16 30h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="36" cy="36" r="10" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.5" />
              <path d="M32 36l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-sm font-display font-medium">No tasks here</p>
            <p className="text-xs text-txt-dim mt-1">Add tasks from your Lists</p>
          </div>
        )}

        {activeGroups.map(({ list, active, completed }) => {
          const groupTotal = active.length + completed.length;
          const progressPct = groupTotal > 0 ? (completed.length / groupTotal) * 100 : 0;

          return (
            <div key={list.id} className="mb-5">
              {/* List group header */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-[3px] h-4 rounded-full" style={{ backgroundColor: list.color }} />
                <span className="text-xs font-display font-medium text-txt-secondary uppercase tracking-wider flex-1">{list.name}</span>
                <span className="text-xs text-txt-dim">{active.length}</span>
              </div>
              {groupTotal > 0 && (
                <div className="h-0.5 rounded-full bg-focus/10 overflow-hidden mb-2 ml-3">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progressPct}%`, backgroundColor: list.color }} />
                </div>
              )}

              {/* Active items */}
              <div className="space-y-1.5">
                {active.map(item => {
                  const subtaskCount = getSubtaskCount(item);
                  const isExpanded = expandedItemId === item.id;
                  let subtasks: Subtask[] = [];
                  if (isExpanded) {
                    try { subtasks = JSON.parse(item.subtasks || '[]'); } catch { /* ignore */ }
                  }

                  return (
                    <div key={item.id}>
                      <button
                        onClick={() => handleItemClick(item, list)}
                        className={`
                          w-full text-left rounded-xl p-3 transition-all duration-200
                          border
                          ${selectedItemId === item.id
                            ? 'bg-focus/5 border-focus/20'
                            : 'border-transparent hover:bg-focus/5'
                          }
                          active:scale-[0.98]
                        `}
                        style={selectedItemId === item.id ? { borderLeftWidth: '3px', borderLeftColor: list.color } : undefined}
                      >
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={(e) => handleToggleComplete(e, item)}
                            className="w-4 h-4 rounded border border-focus/20 hover:border-focus/50 flex-shrink-0 transition-colors"
                          />
                          <span className="flex-1 text-sm text-txt-primary truncate">{item.title}</span>
                          {(item.task_id && !list.task_id) && (
                            <TaskIdBadge taskId={item.task_id} taskName={taskNames[item.task_id] || null} className="text-[10px] text-focus/70 bg-focus/5 px-1.5 py-0.5 rounded" />
                          )}
                          {list.task_id && (
                            <TaskIdBadge taskId={list.task_id} taskName={taskNames[list.task_id] || null} className="text-[10px] text-focus/50" />
                          )}
                          {subtaskCount && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedItemId(isExpanded ? null : item.id);
                              }}
                              className="flex items-center gap-1 text-[10px] text-txt-muted hover:text-txt-secondary transition-colors flex-shrink-0"
                            >
                              <span>{subtaskCount.done}/{subtaskCount.total}</span>
                              <svg
                                width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                                className={`transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
                              >
                                <path d="M2 3.5l3 3 3-3" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </button>

                      {/* Expanded subtask list */}
                      {isExpanded && subtasks.length > 0 && (
                        <div className="ml-4 mt-1 space-y-0.5">
                          {subtasks.map(subtask => (
                            <button
                              key={subtask.id}
                              onClick={() => {
                                const taskId = list.task_id || item.task_id || null;
                                setSelectedItemId(item.id);
                                onSelectTask(taskId, subtask.title);
                              }}
                              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg transition-all
                                ${subtask.completed
                                  ? 'opacity-40 cursor-default'
                                  : 'hover:bg-focus/5 active:scale-[0.98]'
                                }`}
                            >
                              <div className={`w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center ${subtask.completed ? 'border-transparent' : 'border-focus/20'}`}
                                style={subtask.completed ? { backgroundColor: list.color } : undefined}
                              >
                                {subtask.completed && (
                                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                                    <path d="M1.5 4l2 2 3-3" />
                                  </svg>
                                )}
                              </div>
                              <span className={`text-xs flex-1 truncate ${subtask.completed ? 'line-through text-txt-muted' : 'text-txt-secondary'}`}>
                                {subtask.title}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Completed items */}
              {showCompleted && completed.length > 0 && (
                <div className="mt-2 space-y-1 opacity-40">
                  {completed.map(item => (
                    <div key={item.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl">
                      <button
                        onClick={(e) => handleToggleComplete(e, item)}
                        className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: list.color }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M2 5l2.5 2.5L8 3" />
                        </svg>
                      </button>
                      <span className="text-sm text-txt-muted line-through truncate">{item.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

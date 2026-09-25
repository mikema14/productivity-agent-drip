import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { useListsStore } from '../../stores/listsStore';
import { useTaskName, resolveTaskNames } from '../../hooks/useTaskName';
import { getCurrentDate } from '../../utils/time';
import AddItemInline from '../Lists/AddItemInline';
import type { ListItem, ListItemColumn, TaskList } from '../../types';
import type { ViewId } from '../Layout/views';
import PlanSubheader from './PlanSubheader';
import BoardColumn, { ColumnSortable, type ColumnGrouping } from './BoardColumn';
import TaskCard, { type TaskCardActions } from './TaskCard';
import StartOnCTA from './StartOnCTA';
import {
  COLUMNS, ageBadge, capacityLine, formatMinutesPadded, getMonday, partition, resolveDrop, startCandidate, weekRange,
  type BoardColumnKey, type CompletedMode,
} from './boardLogic';

export const SHOW_DONE_KEY = 'allListsOverview_showDone';
export const SHOW_TASK_IDS_KEY = 'allListsOverview_showTaskIds';

interface PlanBoardProps {
  scope: 'all' | 'list';
  onNavigate: (view: ViewId) => void;
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== 'false';
  } catch {
    return true;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // localStorage unavailable: the toggle still works for the session
  }
}

/**
 * The one board behind both Plan scopes (replaces AllListsOverview and
 * ListPlanningView). Owns the DnD context, the expansion state, the
 * Group / Done / IDs toggles and the list filters; the rules live in boardLogic.
 */
export default function PlanBoard({ scope, onNavigate }: PlanBoardProps) {
  const {
    lists, items, selectedListId, selectList, createItem, updateItem, updateList, deleteItem, moveItem, archiveList,
  } = useListsStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [expandedChecklistId, setExpandedChecklistId] = useState<string | null>(null);
  const [openListPickerId, setOpenListPickerId] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState<ListItemColumn | null>(null);
  const [taskNames, setTaskNames] = useState<Record<string, string>>({});
  const [groupByList, setGroupByList] = useState(false);
  const [showDone, setShowDone] = useState(() => readFlag(SHOW_DONE_KEY));
  const [showTaskIds, setShowTaskIds] = useState(() => readFlag(SHOW_TASK_IDS_KEY));
  const [activeListFilters, setActiveListFilters] = useState<Set<string>>(new Set());
  const [focusMinutes, setFocusMinutes] = useState(0);
  const [todayMinutes, setTodayMinutes] = useState<Record<string, number>>({});
  const [weekMinutes, setWeekMinutes] = useState<Record<string, number> | null>(null);

  const selectedList = scope === 'list' ? lists.find(l => l.id === selectedListId) : undefined;
  const listTaskName = useTaskName(selectedList?.task_id || null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // List scope: fall back to the first list when nothing is selected (old ListPlanningView:65).
  useEffect(() => {
    if (scope === 'list' && !selectedListId && lists.length > 0) selectList(lists[0].id);
  }, [scope, lists, selectedListId]);

  // Resolve item task ids to names for the badge tooltips.
  useEffect(() => {
    const ids = items.filter(i => i.task_id && !taskNames[i.task_id]).map(i => i.task_id!);
    if (ids.length === 0) return;
    resolveTaskNames([...new Set(ids)]).then(names => {
      if (Object.keys(names).length > 0) setTaskNames(prev => ({ ...prev, ...names }));
    });
  }, [items]);

  // Today's focus minutes (capacity line, P8) and tracked minutes per task (P7):
  // loaded on mount and whenever the window regains focus.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const today = getCurrentDate();
      const { from, to } = weekRange(new Date());
      try {
        const sessions = await window.timerAPI.getSessions(today);
        if (!cancelled) setFocusMinutes(sessions.filter(s => s.source !== 'break').reduce((sum, s) => sum + s.duration_minutes, 0));
      } catch (error) {
        console.error('Failed to load today\'s sessions:', error);
      }
      const byRange = window.logAPI.getTaskMinutesByRange;
      if (!byRange) return;
      try {
        const [day, week] = await Promise.all([byRange(today, today), byRange(from, to)]);
        if (!cancelled) {
          setTodayMinutes(day);
          setWeekMinutes(week);
        }
      } catch (error) {
        console.error('Failed to load tracked minutes:', error);
      }
    };
    load();
    window.addEventListener('focus', load);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', load);
    };
  }, []);

  // Close the move-to-list dropdown on an outside click.
  useEffect(() => {
    if (!openListPickerId) return;
    const handler = () => setOpenListPickerId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openListPickerId]);

  const completedMode: CompletedMode = scope === 'list' ? 'inline' : showDone ? 'column' : 'hidden';
  const part = useMemo(
    () => partition(items, { scope, listId: selectedListId, filters: activeListFilters, completedMode }),
    [items, scope, selectedListId, activeListFilters, completedMode]
  );

  const now = Date.now();
  const monday = useMemo(() => getMonday(new Date(now)), [Math.floor(now / 3_600_000)]);
  const getList = (item: ListItem): TaskList | undefined => lists.find(l => l.id === item.list_id);

  const actions: TaskCardActions = {
    onToggleComplete: (item) => updateItem(item.id, { completed: item.completed ? 0 : 1 }),
    onToggleExpand: (id) => setExpandedItemId(prev => (prev === id ? null : id)),
    onToggleChecklist: (id) => setExpandedChecklistId(prev => (prev === id ? null : id)),
    onTogglePicker: (id) => setOpenListPickerId(prev => (prev === id ? null : id)),
    onMoveColumn: (item, target) => moveItem(item.id, target, part.columns[target].open.length),
    onMoveToList: (item, listId) => {
      if (listId !== item.list_id) updateItem(item.id, { list_id: listId });
      setOpenListPickerId(null);
    },
    onDelete: (id) => deleteItem(id),
    onUpdate: updateItem,
    onCloseDetail: () => setExpandedItemId(null),
  };

  const handleAddItem = async (column: ListItemColumn, title: string, taskId: string | null, billable?: boolean) => {
    if (!selectedList) return;
    // Inherit the list's billable default unless the add form overrode it.
    const resolvedBillable = billable ?? (selectedList.billable !== 0);
    await createItem({
      list_id: selectedList.id,
      title,
      task_id: taskId,
      column,
      order: part.columns[column].open.length,
      completed: 0,
      archived: 0,
      completed_at: null,
      description: null,
      subtasks: '[]',
      billable: resolvedBillable ? 1 : 0,
    });
  };

  const handleArchiveList = async () => {
    if (!selectedList) return;
    if (confirm('Archive this list? It will be hidden from Lists.')) {
      await archiveList(selectedList.id);
    }
  };

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    if (scope === 'list' && !selectedListId) return;
    const result = resolveDrop({ activeId: active.id as string, overId: over.id as string, items, partition: part });
    if (!result) return;
    const id = active.id as string;
    if (result.kind === 'complete') updateItem(id, { completed: 1 });
    else if (result.kind === 'uncomplete') updateItem(id, { completed: 0, column: result.column });
    else moveItem(id, result.column, result.order);
  };

  const toggleDone = () => setShowDone(prev => { writeFlag(SHOW_DONE_KEY, !prev); return !prev; });
  const toggleTaskIds = () => setShowTaskIds(prev => { writeFlag(SHOW_TASK_IDS_KEY, !prev); return !prev; });
  const toggleFilter = (listId: string) => setActiveListFilters(prev => {
    const next = new Set(prev);
    next.has(listId) ? next.delete(listId) : next.add(listId);
    return next;
  });

  if (scope === 'list' && !selectedList) {
    return (
      <div className="flex items-center justify-center h-full text-txt-muted animate-fade-in">
        <div className="text-center space-y-2">
          <p className="text-lg font-display">No list selected</p>
          <p className="text-sm">Create a list from the Lists panel to get started.</p>
        </div>
      </div>
    );
  }

  // Tracked time is attributed to the item's own task id only (P7): items that
  // inherit the list's id would all repeat the list total. Nothing is rendered
  // when there is no tracked time (a placeholder on every card is noise).
  const minutesFor = (item: ListItem, column: BoardColumnKey): string | null => {
    if (column === 'today') {
      const m = item.task_id ? todayMinutes[item.task_id] ?? 0 : 0;
      return m > 0 ? formatMinutesPadded(m) : null;
    }
    if (column === 'this_week') {
      const m = item.task_id && weekMinutes ? weekMinutes[item.task_id] ?? 0 : 0;
      return m > 0 ? `${formatMinutesPadded(m)} wk` : null;
    }
    return null;
  };

  const weekTotal = weekMinutes ? Object.values(weekMinutes).reduce((sum, m) => sum + m, 0) : null;
  const subtitleFor = (column: ListItemColumn): string | null => {
    if (column === 'today') return capacityLine(focusMinutes);
    if (column === 'this_week') return weekTotal === null ? null : `${formatMinutesPadded(weekTotal)} tracked this week`;
    return null;
  };

  const candidate = startCandidate(part.columns.today.open, lists);

  const renderCard = (column: BoardColumnKey) => (item: ListItem) => {
    const list = getList(item);
    const inDoneColumn = column === 'done';
    const showId = scope === 'list' || showTaskIds;
    return (
      <TaskCard
        key={item.id}
        item={item}
        list={list}
        lists={lists}
        inDoneColumn={inDoneColumn}
        showId={showId}
        showListTag={scope === 'all' && !groupByList}
        taskName={item.task_id ? taskNames[item.task_id] || null : null}
        minutesLabel={item.completed === 1 ? null : minutesFor(item, column)}
        ageBadge={column === 'backlog' && !groupByList ? ageBadge(item, now) : null}
        expanded={expandedItemId === item.id}
        checklistOpen={expandedChecklistId === item.id}
        pickerOpen={openListPickerId === item.id}
        draggable={!(item.completed === 1 && completedMode === 'inline')}
        actions={actions}
      />
    );
  };

  const groupingFor = (column: ListItemColumn): ColumnGrouping => {
    if (groupByList && scope === 'all') return { kind: 'list', lists };
    if (column === 'backlog') return { kind: 'backlog', monday, now };
    return null;
  };

  const dragging = activeId !== null;
  const footerFor = (column: ListItemColumn) => {
    const zone = 'h-[52px] shrink-0 mt-2.5 flex items-center justify-center border border-dashed rounded-[2px] font-display text-[12.5px] transition-colors';
    if (scope === 'list' && selectedList) {
      if (addingColumn === column) {
        return (
          <div className="mt-2.5 shrink-0">
            <AddItemInline
              listId={selectedList.id}
              column={column}
              defaultBillable={selectedList.billable !== 0}
              onAdd={(title, taskId, billable) => handleAddItem(column, title, taskId, billable)}
              onCancel={() => setAddingColumn(null)}
            />
          </div>
        );
      }
      return (
        <button
          type="button"
          onClick={() => setAddingColumn(column)}
          className={`${zone} ${dragging ? 'border-focus/40 text-focus' : 'border-drip-border text-txt-muted hover:text-txt-primary hover:border-txt-dim'}`}
        >
          {dragging ? 'Drop here' : 'Add a task'}
        </button>
      );
    }
    return (
      <div className={`${zone} ${dragging ? 'border-focus/40 text-focus' : 'border-drip-border text-txt-muted'}`}>
        {dragging ? 'Drop here' : 'Drop a task here'}
      </div>
    );
  };

  const activeItem = activeId ? items.find(i => i.id === activeId) : null;
  const activeItemList = activeItem ? getList(activeItem) : null;
  const gridCols = scope === 'all' && showDone ? 'wide:grid-cols-4' : 'wide:grid-cols-3';

  return (
    <div className="flex flex-col h-full min-h-0 animate-fade-in">
      {scope === 'list' && selectedList ? (
        <PlanSubheader
          scope="list"
          list={selectedList}
          listTaskName={listTaskName}
          totalCount={items.filter(i => i.list_id === selectedList.id && !i.archived).length}
          remainingCount={items.filter(i => i.list_id === selectedList.id && !i.completed && !i.archived).length}
          onToggleBillable={(v) => updateList(selectedList.id, { billable: v ? 1 : 0 })}
          onArchive={handleArchiveList}
        />
      ) : (
        <PlanSubheader
          scope="all"
          openCount={items.filter(i => i.completed === 0 && !i.archived).length}
          lists={lists}
          groupByList={groupByList}
          onToggleGroup={() => setGroupByList(prev => !prev)}
          showDone={showDone}
          onToggleDone={toggleDone}
          showTaskIds={showTaskIds}
          onToggleTaskIds={toggleTaskIds}
          filters={activeListFilters}
          onToggleFilter={toggleFilter}
          onClearFilters={() => setActiveListFilters(new Set())}
        />
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div data-testid="plan-grid" className={`flex-1 min-h-0 p-6 flex gap-3 overflow-x-auto wide:grid wide:overflow-x-visible ${gridCols}`}>
          {COLUMNS.map(({ key, label }) => {
            const { open, done } = part.columns[key];
            const sortableIds = open.map(i => i.id);
            return (
              <ColumnSortable key={key} ids={sortableIds}>
                <BoardColumn
                  column={key}
                  label={label}
                  open={open}
                  done={done}
                  subtitle={subtitleFor(key)}
                  progress={scope === 'list' && selectedList ? { done: done.length, total: open.length + done.length, color: selectedList.color } : null}
                  grouping={groupingFor(key)}
                  renderCard={renderCard(key)}
                  beforeFooter={key === 'today' ? <StartOnCTA candidate={candidate} onNavigate={onNavigate} /> : null}
                  footer={footerFor(key)}
                  isAdding={addingColumn === key}
                />
              </ColumnSortable>
            );
          })}
          {scope === 'all' && showDone && (
            <ColumnSortable ids={part.doneColumn.map(i => i.id)}>
              <BoardColumn
                column="done"
                label="Done"
                open={part.doneColumn}
                done={[]}
                grouping={groupByList ? { kind: 'list', lists } : null}
                renderCard={renderCard('done')}
              />
            </ColumnSortable>
          )}
        </div>

        <DragOverlay>
          {activeItem && (
            <div className="px-3 py-2.5 rounded-[2px] bg-drip-elevated border border-focus/30 shadow-lg opacity-90 flex items-center gap-2">
              {activeItemList && <span className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: activeItemList.color }} />}
              <span className="font-display text-[13.5px] text-txt-primary">{activeItem.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

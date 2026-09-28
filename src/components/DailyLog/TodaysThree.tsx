import { useEffect } from 'react';
import { useListsStore } from '../../stores/listsStore';
import type { ListItem, ListItemColumn } from '../../types';
import TaskIdBadge from '../shared/TaskIdBadge';
import { Pill } from '../shared/Pill';
import { effectiveTaskId } from '../Plan/boardLogic';

/**
 * The `Today` section of Review (mockup Review.dc.html:64-101, R2): every
 * today-column item across lists with an outcome per row. Done ⇔ completed,
 * Carry leaves it in Today, To week / Drop move it to This week / Backlog
 * (owner override: Drop is non-destructive). Hidden when Today is empty.
 */
export default function TodaysThree() {
  const { lists, items, loadLists, loadItems, updateItem, moveItem } = useListsStore();

  useEffect(() => {
    if (lists.length === 0) void loadLists();
    if (items.length === 0) void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todayItems = items.filter(i => i.column === 'today' && !i.archived).sort((a, b) => a.order - b.order);
  if (todayItems.length === 0) return null;

  const nextOrder = (column: ListItemColumn) =>
    items.filter(i => i.column === column && !i.archived).reduce((max, i) => Math.max(max, i.order + 1), 0);

  const outcome = (item: ListItem) => {
    const done = item.completed === 1;
    return (
      <span role="group" aria-label="Outcome" className="w-full wide:w-auto flex items-center gap-1 shrink-0">
        <Pill pressed={done} onClick={() => void updateItem(item.id, { completed: done ? 0 : 1 })} className="h-[24px] px-2 text-[11.5px]">Done</Pill>
        <Pill pressed={!done} onClick={() => {}} title="Stays in Today" className="h-[24px] px-2 text-[11.5px]">Carry</Pill>
        <Pill pressed={false} onClick={() => void moveItem(item.id, 'this_week', nextOrder('this_week'))} className="h-[24px] px-2 text-[11.5px]">To week</Pill>
        <Pill pressed={false} onClick={() => void moveItem(item.id, 'backlog', nextOrder('backlog'))} title="Moves to Backlog" className="h-[24px] px-2 text-[11.5px]">Drop</Pill>
      </span>
    );
  };

  return (
    <section aria-label="Today" className="shrink-0 border border-focus/30 rounded-[2px] p-3.5">
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="now-label text-focus">
          Today <span className="text-txt-muted" data-testid="today-count">· {todayItems.length}</span>
        </h2>
        <span className="font-display text-[11.5px] text-txt-muted">Carry-overs stay in Today</span>
      </div>
      <div>
        {todayItems.map(item => {
          const list = lists.find(l => l.id === item.list_id);
          const taskId = effectiveTaskId(item, list);
          const done = item.completed === 1;
          return (
            // Below `wide:` the title keeps the row and the outcome group wraps under it (w-full); at wide it is one 48px line.
            <div key={item.id} data-testid="today-item" className="min-h-[48px] py-2 wide:py-0 flex flex-wrap wide:flex-nowrap items-center gap-x-3 gap-y-1.5 border-t border-drip-elevated first:border-t-0">
              {taskId ? (
                <TaskIdBadge taskId={taskId} taskName={null} plain className={`shrink-0 ${done ? 'opacity-50' : ''}`} />
              ) : (
                <span className="shrink-0 font-display text-[11.5px] text-txt-dim">No task ID</span>
              )}
              <span
                title={item.title}
                className={`flex-1 min-w-0 truncate font-display text-[14px] ${done ? 'text-txt-muted line-through' : 'text-txt-primary'}`}
              >
                {item.title}
              </span>
              {outcome(item)}
            </div>
          );
        })}
      </div>
    </section>
  );
}

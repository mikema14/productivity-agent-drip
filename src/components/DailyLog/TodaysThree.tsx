import { useEffect } from 'react';
import { useListsStore } from '../../stores/listsStore';
import type { ListItem, ListItemColumn } from '../../types';
import { effectiveTaskId } from '../Plan/boardLogic';
import { carriedDays, todayString } from './reviewLogic';

const SEGMENT = 'h-6 px-[7px] transition-colors';

/**
 * `Today · N` in the Close-the-day aside (mockup Review.dc.html, R2, R29, R33):
 * every today-column item across lists. An open item is a card with a joined
 * Done / Carry / Week / Drop control (Carry = stays, Week → This week, Drop →
 * Backlog, never a delete) and `Carried n×` from two workdays on; a done item
 * collapses to one line whose `Done` key reopens it. Hidden when Today is empty.
 */
export default function TodaysThree() {
  const { lists, items, loadLists, loadItems, updateItem, moveItem } = useListsStore();

  useEffect(() => {
    if (lists.length === 0) void loadLists();
    if (items.length === 0) void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byOrder = (a: ListItem, b: ListItem) => a.order - b.order;
  const today = items.filter(i => i.column === 'today' && !i.archived);
  const open = today.filter(i => i.completed !== 1).sort(byOrder);
  const done = today.filter(i => i.completed === 1).sort(byOrder);
  if (today.length === 0) return null;

  const nextOrder = (column: ListItemColumn) =>
    items.filter(i => i.column === column && !i.archived).reduce((max, i) => Math.max(max, i.order + 1), 0);
  const idOf = (item: ListItem) => effectiveTaskId(item, lists.find(l => l.id === item.list_id));
  const now = todayString();

  return (
    <section aria-label="Today" className="flex flex-col gap-1.5 mt-1">
      <h3 className="now-label text-txt-muted">
        Today <span data-testid="today-count">· {today.length}</span>
      </h3>

      {open.map(item => {
        const taskId = idOf(item);
        const carried = carriedDays(item.today_since, now);
        return (
          <div key={item.id} data-testid="today-item" className="flex flex-col gap-1.5 px-3 py-2.5 border border-drip-border rounded-[2px]">
            <span className="flex items-baseline gap-2 min-w-0 font-display text-[13px] text-txt-primary">
              {taskId
                ? <span className="shrink-0 font-mono text-[11px] text-focus">{taskId}</span>
                : <span className="shrink-0 font-display text-[11px] text-txt-dim">No task ID</span>}
              <span title={item.title} className="min-w-0 truncate">{item.title}</span>
            </span>
            <div className="flex items-center justify-between gap-2">
              {carried >= 2
                ? <span data-testid="carried" className="font-mono text-[10px] tracking-[1px] uppercase text-focus whitespace-nowrap">Carried {carried}×</span>
                : <span />}
              <div role="group" aria-label="Outcome" className="shrink-0 inline-flex border border-drip-border font-mono text-[9.5px] tracking-[1px] uppercase">
                <button type="button" aria-pressed={false} onClick={() => void updateItem(item.id, { completed: 1 })} className={`${SEGMENT} text-txt-secondary hover:text-txt-primary hover:bg-focus/5`}>Done</button>
                <button type="button" aria-pressed title="Stays in Today" className={`${SEGMENT} border-l border-drip-border bg-focus text-drip-bg font-semibold`}>Carry</button>
                <button type="button" aria-pressed={false} onClick={() => void moveItem(item.id, 'this_week', nextOrder('this_week'))} title="Moves to This week" className={`${SEGMENT} border-l border-drip-border text-txt-secondary hover:text-txt-primary hover:bg-focus/5`}>Week</button>
                <button type="button" aria-pressed={false} onClick={() => void moveItem(item.id, 'backlog', nextOrder('backlog'))} title="Moves to Backlog" className={`${SEGMENT} border-l border-drip-border text-txt-secondary hover:text-txt-primary hover:bg-focus/5`}>Drop</button>
              </div>
            </div>
          </div>
        );
      })}

      {done.map(item => {
        const taskId = idOf(item);
        return (
          <div key={item.id} data-testid="today-item" data-done="" className="h-7 px-0.5 flex items-center gap-2 font-display text-[13px] text-txt-muted">
            <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-break">
              <path d="M2.5 6.2l2.3 2.3 4.7-5" />
            </svg>
            {taskId && <span className="shrink-0 font-mono text-[11px]">{taskId}</span>}
            <span title={item.title} className="flex-1 min-w-0 truncate">{item.title}</span>
            <button
              type="button"
              aria-pressed
              onClick={() => void updateItem(item.id, { completed: 0 })}
              title="Reopen"
              className="shrink-0 font-mono text-[10px] tracking-[1px] uppercase hover:text-txt-primary transition-colors"
            >
              Done
            </button>
          </div>
        );
      })}
    </section>
  );
}

import { useEffect, useRef, type ReactNode } from 'react';
import { useWindowFocus } from '../../hooks/useWindowFocus';
import { ROW_GRID } from './EntryRow';
import { formatMinutesPadded, type LogSummary } from './reviewLogic';

interface Props {
  viewMode: 'list' | 'timeline';
  summary: LogSummary;
  onSelectToggle: () => void;
  onAddEntry: () => void;
  /** Whether logged rows are listed (filter ALL / LOGGED); the footer's `show` / `hide` flips it. */
  showingLogged: boolean;
  onToggleLogged: () => void;
  /** `logged today` on today's review, `logged` on other days. */
  isToday: boolean;
  /** A day load is in flight while rows from the previous day are still shown. */
  busy?: boolean;
  /** Rows, the timeline, an empty state or the loading text. */
  children: ReactNode;
}

/**
 * The `Time entries` table (mockup Review.dc.html): column header with the
 * select-all box, the rows in their own scroller followed by the dashed
 * `+ Add entry` key, and a 44px footer with the selection and the logged count.
 * Below `wide:` the grid keeps its width and scrolls sideways (rule 9).
 */
export default function EntriesTable(props: Props) {
  const { viewMode, summary, onSelectToggle, onAddEntry, showingLogged, onToggleLogged, isToday, busy = false, children } = props;
  const windowFocused = useWindowFocus();
  const selectAll = useRef<HTMLInputElement>(null);
  const some = summary.selected.count > 0 && !summary.allSelected;

  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = some;
  }, [some]);

  return (
    <section aria-label="Time entries" className="flex-1 min-h-[260px] flex flex-col border border-drip-elevated rounded-[2px]">
      <div data-testid="entries-body" className="flex-1 min-h-0 flex flex-col overflow-x-auto overflow-y-hidden">
        <div className="flex-1 min-h-0 min-w-[680px] wide:min-w-0 flex flex-col">
          {viewMode === 'list' && (
            <div className={`${ROW_GRID} h-9 shrink-0 border-b border-drip-elevated now-label text-txt-muted`} data-testid="entries-columns">
              <input
                ref={selectAll}
                type="checkbox"
                checked={summary.allSelected}
                onChange={() => { if (!busy) onSelectToggle(); }}
                disabled={busy || summary.selectableCount === 0}
                aria-label="Select all loggable entries"
                title={summary.selectableCount === 0 ? 'Nothing to select' : undefined}
                className="w-4 h-4 m-0 accent-focus cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              />
              <span>Time</span><span>Dur</span><span>Task</span><span>Comment → Easy8</span><span>Billable</span><span />
            </div>
          )}
          <div data-testid="entries-scroll" className="flex-1 min-h-0 overflow-y-auto flex flex-col">
            {children}
            <button
              type="button"
              onClick={onAddEntry}
              disabled={busy}
              className="shrink-0 h-11 mx-4 my-2 flex items-center justify-center gap-2.5 border border-dashed border-drip-border rounded-[2px] now-label text-txt-muted hover:text-txt-primary hover:border-txt-dim transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              + Add entry
              {windowFocused && <kbd className="border border-drip-border px-1.5 font-mono text-[10.5px]">N</kbd>}
            </button>
          </div>
        </div>
      </div>

      <div data-testid="entries-footer" className="h-11 shrink-0 px-4 flex items-center justify-between gap-3 border-t border-drip-elevated font-mono text-[10.5px] tracking-[1px] text-txt-muted whitespace-nowrap">
        <span className="min-w-0 truncate">
          <span className="text-txt-primary">{summary.selected.count}</span> selected
          {summary.selected.count > 0 && <> · <span className="text-txt-primary">{formatMinutesPadded(summary.selected.minutes)}</span></>}
          {summary.needsTask > 0 && <> · <span className="text-focus">{summary.needsTask} blocked: needs a task</span></>}
        </span>
        {summary.logged.count > 0 && (
          <span className="shrink-0">
            {summary.logged.count} logged{isToday ? ' today' : ''} ·{' '}
            <button type="button" onClick={onToggleLogged} className="text-focus hover:text-focus-light">
              {showingLogged ? 'hide' : 'show'}
            </button>
          </span>
        )}
      </div>
    </section>
  );
}

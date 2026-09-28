import { Fragment, useEffect, useRef } from 'react';
import { formatMinutes, relativeTime } from '../../utils/time';
import type { PickerSource, PickerTask } from '../../hooks/useTaskPickerNav';

interface Props {
  /** DOM id of the listbox; options get `${id}-opt-${index}`. */
  id: string;
  tasks: PickerTask[];
  query: string;
  isSearching: boolean;
  /** Highlighted index, -1 for none. */
  highlighted: number;
  /** Bumped on every keyboard move; only then is the highlighted row scrolled into view. */
  scrollTick: number;
  onHover: (index: number) => void;
  onSelect: (task: PickerTask) => void;
  /** Task the user already has selected (shows the amber marker). */
  currentTaskId?: string;
  /** With `onSourceChange`, the label becomes a Recent tasks | Planned switch. */
  source?: PickerSource;
  onSourceChange?: (source: PickerSource) => void;
}

const GROUP_LABEL = { today: 'Today', this_week: 'This week' } as const;

export function optionId(listId: string, index: number): string {
  return `${listId}-opt-${index}`;
}

function Kbd({ children }: { children: string }) {
  return <kbd className="font-mono text-[11px] px-1 py-0.5 rounded-[2px] border border-drip-border bg-drip-surface">{children}</kbd>;
}

export default function TaskResultList({
  id, tasks, query, isSearching, highlighted, scrollTick, onHover, onSelect, currentTaskId,
  source = 'recent', onSourceChange,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trimmed = query.trim();

  // Keyboard navigation only - hovering must never scroll the list under the pointer.
  useEffect(() => {
    if (scrollTick === 0 || highlighted < 0) return;
    const el = scrollRef.current?.ownerDocument.getElementById(optionId(id, highlighted));
    el?.scrollIntoView({ block: 'nearest' });
  }, [scrollTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = !trimmed ? 'Recent tasks' : isSearching ? 'Searching…' : `All tasks · ${tasks.length}`;
  const showSwitch = !trimmed && !!onSourceChange;

  const sourceKey = (key: PickerSource, text: string, extra = '') => (
    <button
      type="button"
      onClick={() => onSourceChange?.(key)}
      aria-pressed={source === key}
      className={`px-2.5 h-6 now-label whitespace-nowrap transition-colors ${extra} ${
        source === key ? 'bg-focus text-drip-bg' : 'text-txt-muted hover:text-txt-primary hover:bg-focus/5'
      }`}
    >
      {text}
    </button>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Label row - always rendered so its height never pops in or out */}
      <div className="shrink-0 px-3 h-8 flex items-center gap-2.5" aria-live="polite">
        {showSwitch ? (
          <span className="inline-flex border border-drip-border" role="group" aria-label="Task source">
            {sourceKey('recent', 'Recent tasks')}
            {sourceKey('planned', 'Planned', 'border-l border-drip-border')}
          </span>
        ) : (
          <span className={`now-label ${trimmed ? 'text-txt-muted' : 'text-focus'}`}>{label}</span>
        )}
        <span className="flex-1 border-t border-drip-border" />
        {!trimmed && (
          <span className="font-display text-[11px] text-txt-muted">{source === 'planned' ? 'from Plan' : 'by frequency'}</span>
        )}
      </div>

      <div
        ref={scrollRef}
        id={id}
        role="listbox"
        aria-label="Tasks"
        className="picker-list flex-1 min-h-0 px-1 pb-1"
        style={{ maxHeight: 280, overflowY: 'auto' }}
      >
        {tasks.length > 0 ? (
          tasks.map((task, i) => {
            const isCurrent = task.task_id === currentTaskId;
            const isHighlighted = i === highlighted;
            const today = task.todayMinutes ?? 0;
            const planned = task.planned;
            const groupStart = planned && planned.column !== tasks[i - 1]?.planned?.column;
            return (
              <Fragment key={planned?.itemId ?? task.task_id}>
              {groupStart && (
                <div role="presentation" className="now-label text-txt-muted px-3 pt-2 pb-1">{GROUP_LABEL[planned.column]}</div>
              )}
              <div
                id={optionId(id, i)}
                role="option"
                aria-selected={isHighlighted}
                aria-current={isCurrent || undefined}
                onMouseEnter={() => onHover(i)}
                // Keep focus in the search input so keyboard nav continues after a click
                onMouseDown={e => e.preventDefault()}
                onClick={() => onSelect(task)}
                className={`relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 py-1.5 pr-3 rounded-[2px] border cursor-pointer transition-colors duration-150 ${
                  isHighlighted ? 'bg-focus/[0.06] border-focus/30' : 'border-transparent'
                }`}
                style={{ paddingLeft: isCurrent ? 15 : 12 }}
              >
                {isCurrent && (
                  <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-focus" />
                )}
                {task.task_id ? (
                  <span className="font-mono text-[12px] leading-4 text-focus bg-focus/10 rounded-[2px] px-1.5 py-0.5">
                    {task.task_id}
                  </span>
                ) : (
                  <span className="font-display text-[11px] leading-4 text-txt-muted">No task ID</span>
                )}
                <span className="text-[13px] leading-4 text-txt-primary truncate" title={task.title}>
                  {task.title}
                </span>
                {planned ? (
                  <span className="flex items-center gap-1.5 font-display text-[11px] leading-4 text-txt-muted min-w-0 max-w-[140px]">
                    <span aria-hidden className="w-[6px] h-[6px] rounded-full shrink-0" style={{ backgroundColor: planned.listColor }} />
                    <span className="truncate">{planned.listName}</span>
                  </span>
                ) : today > 0 ? (
                  <span className="font-mono text-[11px] leading-4 text-txt-primary" title="Tracked today">
                    {formatMinutes(today)}
                  </span>
                ) : (
                  <span className="font-mono text-[11px] leading-4 text-txt-muted" title="Last used">
                    {relativeTime(task.last_seen_at)}
                  </span>
                )}
                {task.project_name && (
                  <span className="col-start-2 col-span-2 font-display text-xs leading-4 text-txt-muted break-words">
                    {task.project_name}
                  </span>
                )}
              </div>
              </Fragment>
            );
          })
        ) : isSearching ? null : trimmed ? (
          <div className="px-2 py-3 text-[13px] text-txt-muted text-center">
            No matching tasks.{' '}
            {/^\d+$/.test(trimmed) && (
              <span>Press <Kbd>Enter</Kbd> to fetch</span>
            )}
          </div>
        ) : source === 'planned' ? (
          <div className="px-2 py-3 text-[13px] text-txt-muted text-center">
            Nothing planned for today or this week.
          </div>
        ) : (
          <div className="px-2 py-3 text-[13px] text-txt-muted text-center">
            No recent tasks. Type a task ID and press <Kbd>Enter</Kbd>.
          </div>
        )}
      </div>
    </div>
  );
}

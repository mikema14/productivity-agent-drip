import { useEffect, useRef } from 'react';
import { formatMinutes, relativeTime } from '../../utils/time';
import type { PickerTask } from '../../hooks/useTaskPickerNav';

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
}

export function optionId(listId: string, index: number): string {
  return `${listId}-opt-${index}`;
}

const kbdStyle = { background: 'oklch(1 0 0 / 0.06)', border: '0.5px solid oklch(1 0 0 / 0.08)' };

export default function TaskResultList({
  id, tasks, query, isSearching, highlighted, scrollTick, onHover, onSelect, currentTaskId,
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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Label row - always rendered so its height never pops in or out */}
      <div
        className="shrink-0 px-4 h-6 flex items-center font-medium uppercase text-focus"
        style={{ fontSize: '10.5px', letterSpacing: '0.08em' }}
        aria-live="polite"
      >
        {label}
      </div>

      <div
        ref={scrollRef}
        id={id}
        role="listbox"
        aria-label="Tasks"
        className="picker-list flex-1 min-h-0 px-2 pb-2"
        style={{ maxHeight: 280, overflowY: 'auto' }}
      >
        {tasks.length > 0 ? (
          tasks.map((task, i) => {
            const isCurrent = task.task_id === currentTaskId;
            const isHighlighted = i === highlighted;
            const today = task.todayMinutes ?? 0;
            return (
              <div
                key={task.task_id}
                id={optionId(id, i)}
                role="option"
                aria-selected={isHighlighted}
                aria-current={isCurrent || undefined}
                onMouseEnter={() => onHover(i)}
                // Keep focus in the search input so keyboard nav continues after a click
                onMouseDown={e => e.preventDefault()}
                onClick={() => onSelect(task)}
                className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 py-1 pr-2 rounded-[9px] cursor-pointer transition-colors duration-150"
                style={{
                  paddingLeft: isCurrent ? 15 : 8,
                  background: isHighlighted ? 'oklch(1 0 0 / 0.05)' : 'transparent',
                }}
              >
                {isCurrent && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 -translate-y-1/2"
                    style={{ width: 3, height: 28, background: '#f59e0b', borderRadius: '0 2px 2px 0' }}
                  />
                )}
                <span
                  className="font-mono text-[12px] leading-4 text-focus rounded-full px-2 py-0.5"
                  style={{ background: 'oklch(0.78 0.14 70 / 0.15)' }}
                >
                  {task.task_id}
                </span>
                <span className="text-[13px] leading-4 text-txt-secondary truncate" title={task.title}>
                  {task.title}
                </span>
                {today > 0 ? (
                  <span className="font-mono text-[11px] leading-4 text-txt-secondary" title="Tracked today">
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
            );
          })
        ) : isSearching ? null : trimmed ? (
          <div className="px-2 py-3 text-[13px] text-txt-muted text-center">
            No matching tasks.{' '}
            {/^\d+$/.test(trimmed) && (
              <span>Press <kbd className="font-mono text-[11px] px-1 py-0.5 rounded" style={kbdStyle}>Enter</kbd> to fetch</span>
            )}
          </div>
        ) : (
          <div className="px-2 py-3 text-[13px] text-txt-muted text-center">
            No recent tasks. Type a task ID and press <kbd className="font-mono text-[11px] px-1 py-0.5 rounded" style={kbdStyle}>Enter</kbd>.
          </div>
        )}
      </div>
    </div>
  );
}

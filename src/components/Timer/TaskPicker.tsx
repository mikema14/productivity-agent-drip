import { useRef, useId } from 'react';
import { useTaskPickerNav } from '../../hooks/useTaskPickerNav';
import TaskResultList, { optionId } from './TaskResultList';
import type { TaskCache, RankedTask } from '../../types';

interface Props {
  recentTasks: RankedTask[];
  onSelect: (task: TaskCache) => void;
  searchRef?: React.RefObject<HTMLInputElement>;
}

/**
 * Idle task picker: search input plus an always-visible, scrollable task list.
 * It fills whatever height its parent gives it; the list scrolls internally.
 */
export default function TaskPicker({ recentTasks, onSelect, searchRef }: Props) {
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = searchRef || internalRef;
  const listId = `task-picker-${useId().replace(/:/g, '')}`;

  const nav = useTaskPickerNav({ recentTasks, onSelect });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (nav.handleNavKey(e)) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      // First Esc clears the query, the second leaves the field. The list stays either way.
      if (nav.query) nav.clearQuery();
      else inputRef.current?.blur();
    }
  };

  return (
    <div
      className="flex-1 min-h-0 flex flex-col rounded-[14px] overflow-hidden"
      style={{
        background: 'oklch(1 0 0 / 0.03)',
        border: '0.5px solid oklch(1 0 0 / 0.08)',
      }}
    >
      <div
        className="shrink-0 m-2 flex items-center gap-2 px-3 rounded-[10px]"
        style={{ height: 40, background: 'oklch(1 0 0 / 0.05)' }}
      >
        <svg className="w-4 h-4 text-txt-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <circle cx="11" cy="11" r="7" strokeWidth="1.8" />
          <line x1="16.5" y1="16.5" x2="22" y2="22" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          value={nav.query}
          onChange={e => nav.setQuery(e.target.value)}
          onFocus={nav.onFocus}
          onBlur={nav.onBlur}
          onKeyDown={handleKeyDown}
          placeholder="Search task ID or title…"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={nav.highlighted >= 0 ? optionId(listId, nav.highlighted) : undefined}
          className="flex-1 min-w-0 bg-transparent text-[13px] text-txt-primary placeholder-txt-muted focus:outline-none"
        />
        {/* Fixed-width slot so the spinner text never shifts the input */}
        <span className="w-14 shrink-0 text-right text-[11px] text-txt-muted animate-pulse" aria-hidden={!nav.isFetching}>
          {nav.isFetching ? 'Fetching…' : ''}
        </span>
      </div>

      <TaskResultList
        id={listId}
        tasks={nav.results}
        query={nav.query}
        isSearching={nav.isSearching}
        highlighted={nav.highlighted}
        scrollTick={nav.scrollTick}
        onHover={nav.onHover}
        onSelect={nav.select}
      />
    </div>
  );
}

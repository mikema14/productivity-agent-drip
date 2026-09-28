import { useRef, useId } from 'react';
import { useTaskPickerNav } from '../../hooks/useTaskPickerNav';
import TaskResultList, { optionId } from './TaskResultList';
import type { TaskCache, RankedTask } from '../../types';

interface Props {
  recentTasks: RankedTask[];
  onSelect: (task: TaskCache) => void;
  searchRef?: React.RefObject<HTMLInputElement>;
}

function SearchIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-txt-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 16 16" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
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
    <div className="flex-1 min-h-0 flex flex-col border border-drip-elevated p-2 overflow-hidden">
      <div className="shrink-0 flex items-center gap-2.5 px-3 h-10 rounded-[2px] bg-drip-surface">
        <SearchIcon />
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
        <kbd aria-hidden className="font-mono text-[11px] text-txt-secondary border border-drip-border rounded-[2px] px-1.5 leading-4">/</kbd>
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

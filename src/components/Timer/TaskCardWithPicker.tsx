import { useRef, useEffect, useId, type ReactNode } from 'react';
import { useTimerStore } from '../../stores/timerStore';
import { useTaskPickerNav } from '../../hooks/useTaskPickerNav';
import TaskResultList, { optionId } from './TaskResultList';
import type { TaskCache, RankedTask } from '../../types';

interface Props {
  task: TaskCache;
  note: string;
  recentTasks: RankedTask[];
  pickerOpen: boolean;
  onToggle: () => void;
  onSelectTask: (task: TaskCache) => void;
  onNoteChange: (note: string) => void;
  searchRef: React.RefObject<HTMLInputElement>;
  /** Rendered between the id row and the note input when collapsed (the duration strip). */
  beforeNote?: ReactNode;
}

function DownChevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-txt-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 16 16" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
}

export default function TaskCardWithPicker({
  task, note, recentTasks, pickerOpen, onToggle, onSelectTask, onNoteChange, searchRef, beforeNote,
}: Props) {
  const { sessionCount } = useTimerStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = searchRef || internalRef;
  const listId = `task-card-picker-${useId().replace(/:/g, '')}`;

  const nav = useTaskPickerNav({ recentTasks, onSelect: onSelectTask });
  const queryRef = useRef(nav.query);
  queryRef.current = nav.query;

  // Reset query and focus search when picker opens
  useEffect(() => {
    if (pickerOpen) {
      nav.clearQuery();
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [pickerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc (clears the query first, then closes) and outside-click close the open picker
  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (queryRef.current) nav.clearQuery();
      else onToggle();
    };
    const onMouse = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onToggle();
      }
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onMouse);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onMouse);
    };
  }, [pickerOpen, onToggle]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className={`flex flex-col gap-3 ${pickerOpen ? 'flex-1 min-h-0' : ''}`}
    >
      {/* Row 1: clickable id row — always visible, chevron rotates when open */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        aria-expanded={pickerOpen}
        className="shrink-0 flex flex-col gap-1 cursor-pointer group"
      >
        <span className="now-label text-txt-muted flex items-center gap-2">
          <span className="text-focus normal-case tracking-normal font-mono text-[12px]">{task.task_id}</span>
          {task.project_name && <span className="truncate">— {task.project_name}</span>}
          <span
            className="ml-auto text-txt-muted group-hover:text-txt-primary transition-transform"
            style={{ transform: pickerOpen ? 'rotate(180deg)' : 'rotate(0deg)', transitionDuration: '250ms' }}
          >
            <DownChevron />
          </span>
        </span>
        <span className="font-display text-[22px] font-medium leading-tight tracking-[-0.3px] text-txt-primary truncate" title={task.title}>
          {task.title}
        </span>
      </div>

      {pickerOpen ? (
        /* Expanded: search + shared scrollable list */
        <div className="flex-1 min-h-0 flex flex-col border border-drip-elevated p-2 overflow-hidden">
          <div className="shrink-0 flex items-center gap-2.5 px-3 h-10 rounded-[2px] bg-drip-surface">
            <SearchIcon />
            <input
              ref={inputRef}
              value={nav.query}
              onChange={e => nav.setQuery(e.target.value)}
              onFocus={nav.onFocus}
              onBlur={nav.onBlur}
              onKeyDown={e => { nav.handleNavKey(e); }}
              placeholder="Search task ID or title…"
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={nav.highlighted >= 0 ? optionId(listId, nav.highlighted) : undefined}
              className="flex-1 min-w-0 bg-transparent text-[13px] text-txt-primary placeholder-txt-muted focus:outline-none"
            />
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
            currentTaskId={task.task_id}
          />
        </div>
      ) : (
        /* Collapsed: duration strip, note input, footer */
        <>
          {beforeNote}
          <input
            ref={noteInputRef}
            value={note}
            onChange={e => onNoteChange(e.target.value)}
            placeholder="Session note (optional)"
            aria-label="Session note"
            className="w-full h-9 px-3 bg-transparent border border-drip-border text-[13px] text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-focus/40"
          />
          <div className="flex items-center justify-between font-mono text-[11px] text-txt-muted">
            <span>{task.project_name || ''}</span>
            <span>
              Today<span className="text-txt-dim px-1.5">·</span>{sessionCount}/8 sessions
            </span>
          </div>
        </>
      )}
    </div>
  );
}

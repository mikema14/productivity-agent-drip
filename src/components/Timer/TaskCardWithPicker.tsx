import { useRef, useEffect, useId } from 'react';
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
}

function NoteIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 10.5V2.5a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5H4l-2 2z" />
    </svg>
  );
}

function DownChevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export default function TaskCardWithPicker({
  task, note, recentTasks, pickerOpen, onToggle, onSelectTask, onNoteChange, searchRef,
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
      className={`rounded-[14px] overflow-hidden ${pickerOpen ? 'flex-1 min-h-0 flex flex-col' : ''}`}
      style={{
        background: 'oklch(1 0 0 / 0.03)',
        border: '0.5px solid oklch(1 0 0 / 0.08)',
      }}
    >
      {/* Row 1: clickable id row — always visible, chevron rotates when open */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        aria-expanded={pickerOpen}
        className="shrink-0 m-2 flex items-center gap-2 px-3 rounded-[10px] cursor-pointer hover:bg-white/[0.02] transition-colors"
        style={{
          height: 40,
          background: 'oklch(1 0 0 / 0.05)',
          border: '0.5px solid oklch(1 0 0 / 0.06)',
        }}
      >
        <span className="font-mono text-[12px] text-focus shrink-0">{task.task_id}</span>
        <span className="flex-1" />
        <span className="text-[12px] text-txt-secondary truncate max-w-[55%]">
          {[task.title, task.project_name].filter(Boolean).join(' — ')}
        </span>
        <span
          className="text-txt-muted shrink-0 transition-transform"
          style={{ transform: pickerOpen ? 'rotate(180deg)' : 'rotate(0deg)', transitionDuration: '250ms' }}
        >
          <DownChevron />
        </span>
      </div>

      {pickerOpen ? (
        /* Expanded: search + shared scrollable list */
        <>
          <div className="shrink-0" style={{ height: '0.5px', background: 'oklch(1 0 0 / 0.08)', margin: '0 8px' }} />

          <div
            className="shrink-0 mx-2 mt-2 mb-1 flex items-center gap-2 px-3 rounded-[10px]"
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
        </>
      ) : (
        /* Collapsed: note input + footer */
        <>
          <div className="flex items-center gap-2 px-4">
            <NoteIcon className="text-txt-muted shrink-0" />
            <input
              ref={noteInputRef}
              value={note}
              onChange={e => onNoteChange(e.target.value)}
              placeholder="Session note (optional)"
              className="flex-1 h-9 bg-transparent text-[13px] text-txt-primary placeholder:text-txt-muted placeholder:italic focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between px-4 pb-3">
            <span className="font-mono text-[11.5px] text-txt-muted">{task.project_name || ''}</span>
            <span className="text-[11.5px] text-txt-muted">
              Today<span className="text-txt-dim px-1.5">·</span>{sessionCount}/8 sessions
            </span>
          </div>
        </>
      )}
    </div>
  );
}

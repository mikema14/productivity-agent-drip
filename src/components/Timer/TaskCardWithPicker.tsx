import { useState, useRef, useEffect } from 'react';
import { useTimerStore } from '../../stores/timerStore';
import { useTaskSearch } from '../../hooks/useTaskSearch';
import type { TaskCache } from '../../types';

interface Props {
  task: TaskCache;
  note: string;
  recentTasks: TaskCache[];
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

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${diffH}h`;
  if (diffD === 1) return 'Yesterday';
  return `${diffD}d`;
}

export default function TaskCardWithPicker({
  task, note, recentTasks, pickerOpen, onToggle, onSelectTask, onNoteChange, searchRef,
}: Props) {
  const { sessionCount } = useTimerStore();
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = searchRef || internalRef;

  // Reset query and focus search when picker opens
  useEffect(() => {
    if (pickerOpen) {
      setQuery('');
      setHighlighted(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [pickerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Esc or outside-click when picker is open
  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onToggle(); }
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
  }, [pickerOpen, onToggle]);

  // Empty query -> the short recents list; typing searches the full task history
  const { results: filtered, isSearching } = useTaskSearch(query, recentTasks);

  const handleSearchKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0 && highlighted < filtered.length) {
        onSelectTask(filtered[highlighted]);
      } else if (query.trim() && /^\d+$/.test(query.trim())) {
        setIsLoading(true);
        try {
          const baseUrl = await window.timerAPI.getSettings('apiBaseUrl') || '';
          const apiKey = await window.timerAPI.getSettings('apiKey') || '';
          if (baseUrl && apiKey && window.timerAPI.getIssue) {
            const issue = await window.timerAPI.getIssue(baseUrl, apiKey, query.trim());
            if (issue) {
              onSelectTask({
                task_id: issue.taskId,
                title: issue.title,
                project_id: issue.projectId,
                project_name: issue.projectName,
                last_seen_at: new Date().toISOString(),
              });
            }
          }
        } catch {
          // silently ignore
        } finally {
          setIsLoading(false);
        }
      }
    }
    // Esc is handled by the document-level listener above
  };

  return (
    <div
      ref={containerRef}
      className="rounded-[14px] overflow-hidden"
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
        className="m-2 flex items-center gap-2 px-3 rounded-[10px] cursor-pointer hover:bg-white/[0.02] transition-colors"
        style={{
          height: 40,
          background: 'oklch(1 0 0 / 0.05)',
          border: '0.5px solid oklch(1 0 0 / 0.06)',
        }}
      >
        <span className="font-mono text-[12px] text-txt-muted shrink-0">#</span>
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
        /* Expanded: search + scrollable list */
        <>
          <div style={{ height: '0.5px', background: 'oklch(1 0 0 / 0.08)', margin: '0 8px' }} />

          {/* Search sub-capsule */}
          <div
            className="mx-2 mt-2 flex items-center gap-2 px-3 rounded-[10px]"
            style={{ height: 40, background: 'oklch(1 0 0 / 0.05)' }}
          >
            <svg className="w-4 h-4 text-txt-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" strokeWidth="1.8" />
              <line x1="16.5" y1="16.5" x2="22" y2="22" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setHighlighted(0); }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search task ID or title…"
              className="flex-1 bg-transparent text-[13px] text-txt-primary placeholder-txt-muted focus:outline-none"
            />
            {(isLoading || isSearching) && <span className="text-[11px] text-txt-muted animate-pulse">Loading…</span>}
          </div>

          {/* Section label */}
          {filtered.length > 0 && (
            <div
              className="px-4 pt-3 pb-1.5 font-medium uppercase text-focus"
              style={{ fontSize: '10.5px', letterSpacing: '0.08em' }}
            >
              {query.trim() ? `All tasks · ${filtered.length}` : 'Recent tasks'}
            </div>
          )}

          {/* Scrollable list */}
          <div className="px-2 pb-2 picker-list" style={{ maxHeight: 280, overflowY: 'auto' }}>
            {filtered.length > 0 ? (
              filtered.map((t, i) => {
                const isCurrent = t.task_id === task.task_id;
                return (
                  <button
                    key={t.task_id}
                    onClick={() => onSelectTask(t)}
                    onMouseEnter={() => setHighlighted(i)}
                    className="w-full flex items-center gap-2.5 py-2 text-left transition-all duration-100 rounded-[9px] relative overflow-hidden"
                    style={{
                      paddingLeft: isCurrent ? 15 : 8,
                      paddingRight: 8,
                      background: i === highlighted ? 'oklch(1 0 0 / 0.05)' : 'transparent',
                    }}
                  >
                    {/* Amber left accent bar for current selection */}
                    {isCurrent && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2"
                        style={{ width: 3, height: 28, background: '#f59e0b', borderRadius: '0 2px 2px 0' }}
                      />
                    )}
                    <span
                      className="font-mono text-[12px] text-focus shrink-0 rounded-full px-2 py-0.5"
                      style={{ background: 'oklch(0.78 0.14 70 / 0.15)' }}
                    >
                      {t.task_id}
                    </span>
                    <span className="flex-1 text-[13px] text-txt-secondary truncate min-w-0">{t.title}</span>
                    {t.project_name && (
                      <span className="font-mono text-[11px] text-txt-muted shrink-0 truncate max-w-[80px]">{t.project_name}</span>
                    )}
                    <span className="text-[11px] text-txt-muted shrink-0">{relativeTime(t.last_seen_at)}</span>
                  </button>
                );
              })
            ) : isSearching ? (
              <div className="px-2 py-3 text-[13px] text-txt-muted text-center">Searching…</div>
            ) : query.trim() ? (
              <div className="px-2 py-3 text-[13px] text-txt-muted text-center">
                No matching tasks.{' '}
                {/^\d+$/.test(query.trim()) && (
                  <span>Press <kbd className="font-mono text-[11px] px-1 py-0.5 rounded" style={{ background: 'oklch(1 0 0 / 0.06)', border: '0.5px solid oklch(1 0 0 / 0.08)' }}>Enter</kbd> to fetch</span>
                )}
              </div>
            ) : (
              <div className="px-2 py-3 text-[13px] text-txt-muted text-center">No recent tasks</div>
            )}
          </div>
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

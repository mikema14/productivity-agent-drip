import { useState, useRef, useEffect, useCallback } from 'react';
import type { TaskCache } from '../../types';

interface Props {
  recentTasks: TaskCache[];
  onSelect: (task: TaskCache) => void;
  searchRef?: React.RefObject<HTMLInputElement>;
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

export default function TaskPicker({ recentTasks, onSelect, searchRef }: Props) {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = searchRef || internalRef;

  const filtered = query.trim()
    ? recentTasks.filter(t =>
        t.task_id.includes(query) ||
        t.title.toLowerCase().includes(query.toLowerCase())
      )
    : recentTasks;

  // List is visible when focused or query is non-empty
  const showList = listOpen;

  // Outside-click collapses list
  useEffect(() => {
    if (!showList) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setListOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showList]);

  const handleSelect = useCallback((task: TaskCache) => {
    setListOpen(false);
    setQuery('');
    onSelect(task);
  }, [onSelect]);

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0 && highlighted < filtered.length) {
        handleSelect(filtered[highlighted]);
      } else if (query.trim() && /^\d+$/.test(query.trim())) {
        setIsLoading(true);
        try {
          const baseUrl = await window.timerAPI.getSettings('apiBaseUrl') || '';
          const apiKey = await window.timerAPI.getSettings('apiKey') || '';
          if (baseUrl && apiKey && window.timerAPI.getIssue) {
            const issue = await window.timerAPI.getIssue(baseUrl, apiKey, query.trim());
            if (issue) {
              handleSelect({
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
    } else if (e.key === 'Escape') {
      if (query.trim()) {
        setQuery('');
      } else {
        setListOpen(false);
        inputRef.current?.blur();
      }
    }
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
      {/* Search sub-capsule — always visible */}
      <div
        className="m-2 flex items-center gap-2 px-3 rounded-[10px]"
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
          onFocus={() => setListOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search task ID or title…"
          className="flex-1 bg-transparent text-[13px] text-txt-primary placeholder-txt-muted focus:outline-none"
        />
        {isLoading && <span className="text-[11px] text-txt-muted animate-pulse">Loading…</span>}
        <span
          onClick={(e) => {
            e.stopPropagation();
            if (listOpen) {
              setListOpen(false);
              setQuery('');
            } else {
              setListOpen(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }
          }}
          className="text-txt-muted shrink-0 transition-transform cursor-pointer hover:text-txt-secondary"
          style={{ transform: listOpen ? 'rotate(180deg)' : 'rotate(0deg)', transitionDuration: '250ms' }}
        >
          <DownChevron />
        </span>
      </div>

      {/* List — visible only when focused or querying */}
      {showList && (
        <>
          {filtered.length > 0 && (
            <div
              className="px-4 pb-1.5 font-medium uppercase text-focus"
              style={{ fontSize: '10.5px', letterSpacing: '0.08em' }}
            >
              Recent tasks
            </div>
          )}

          <div className="px-2 pb-2 picker-list" style={{ maxHeight: 280, overflowY: 'auto' }}>
            {filtered.length > 0 ? (
              filtered.map((task, i) => (
                <button
                  key={task.task_id}
                  onClick={() => handleSelect(task)}
                  onMouseEnter={() => setHighlighted(i)}
                  className="w-full flex items-center gap-2.5 px-2 py-2 text-left transition-all duration-100 rounded-[9px]"
                  style={{
                    background: i === highlighted ? 'oklch(1 0 0 / 0.05)' : 'transparent',
                  }}
                >
                  <span
                    className="font-mono text-[12px] text-focus shrink-0 rounded-full px-2 py-0.5"
                    style={{ background: 'oklch(0.78 0.14 70 / 0.15)' }}
                  >
                    {task.task_id}
                  </span>
                  <span className="flex-1 text-[13px] text-txt-secondary truncate min-w-0">{task.title}</span>
                  {task.project_name && (
                    <span className="font-mono text-[11px] text-txt-muted shrink-0 truncate max-w-[80px]">{task.project_name}</span>
                  )}
                  <span className="text-[11px] text-txt-muted shrink-0">{relativeTime(task.last_seen_at)}</span>
                </button>
              ))
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
      )}
    </div>
  );
}

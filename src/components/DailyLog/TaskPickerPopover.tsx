import { useEffect, useRef, useState } from 'react';
import { useTaskSearch } from '../../hooks/useTaskSearch';
import type { TaskCache } from '../../types';

interface Props {
  onPick: (taskId: string, title: string) => void;
  onClose: () => void;
}

const LIMIT = 8;

/** Cache first, then Easy8 (`get-issue` caches what it finds; the GET is tolerated, P17). */
async function lookupTask(id: string): Promise<{ taskId: string; title: string }> {
  const cached = await window.logAPI.getCachedTask(id).catch(() => null);
  if (cached) return { taskId: cached.task_id, title: cached.title };
  const baseUrl = (await window.timerAPI.getSettings('apiBaseUrl')) || 'https://es.easyproject.com';
  const apiKey = await window.timerAPI.getSettings('apiKey');
  if (!apiKey || !window.timerAPI.getIssue) throw new Error('API not configured');
  const issue = await window.timerAPI.getIssue(baseUrl, apiKey, id);
  return { taskId: issue.taskId, title: issue.title };
}

/**
 * Review's task picker (R26): anchored under a row's Task cell. Recent tasks at
 * rest, the whole task cache while typing, ↑↓ + Enter, and a bare numeric id +
 * Enter fetches the issue. Esc or a click outside closes it without a write.
 */
export default function TaskPickerPopover({ onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<TaskCache[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const [lookup, setLookup] = useState<{ state: 'idle' } | { state: 'loading' } | { state: 'error'; message: string }>({ state: 'idle' });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { results } = useTaskSearch(query, recents);
  const options = results.slice(0, LIMIT);

  useEffect(() => {
    inputRef.current?.focus();
    let alive = true;
    window.logAPI.getRecentTasks().then(tasks => { if (alive) setRecents(tasks); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  useEffect(() => { setHighlighted(0); }, [query]);

  const fetchById = async (id: string) => {
    setLookup({ state: 'loading' });
    try {
      const task = await lookupTask(id);
      onPick(task.taskId, task.title);
    } catch (error) {
      setLookup({ state: 'error', message: error instanceof Error ? error.message : `Task ${id} not found` });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(i => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const id = query.trim();
      const exact = options.find(t => t.task_id === id);
      if (exact) onPick(exact.task_id, exact.title);
      else if (/^\d+$/.test(id)) void fetchById(id);
      else if (options[highlighted]) onPick(options[highlighted].task_id, options[highlighted].title);
    }
  };

  return (
    <div
      ref={wrapperRef}
      data-testid="task-picker"
      className="absolute left-0 top-full mt-1 z-20 w-[320px] bg-drip-surface border border-drip-border rounded-[2px] shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setLookup({ state: 'idle' }); }}
        onKeyDown={onKeyDown}
        placeholder="Task ID or title"
        aria-label="Find a task"
        className="w-full h-9 px-3 text-sm bg-transparent border-b border-drip-elevated text-txt-primary placeholder-txt-dim focus:outline-none"
      />
      <div role="listbox" aria-label="Tasks" className="max-h-64 overflow-y-auto py-1">
        {options.map((task, i) => (
          <button
            key={task.task_id}
            type="button"
            role="option"
            aria-selected={i === highlighted}
            onMouseDown={e => { e.preventDefault(); onPick(task.task_id, task.title); }}
            onMouseEnter={() => setHighlighted(i)}
            className={`w-full h-8 px-3 flex items-center gap-3 text-left transition-colors ${i === highlighted ? 'bg-focus/10' : ''}`}
          >
            <span className="shrink-0 font-mono text-[12px] text-focus">{task.task_id}</span>
            <span className="min-w-0 truncate font-display text-[13px] text-txt-secondary">{task.title}</span>
          </button>
        ))}
        {options.length === 0 && lookup.state === 'idle' && (
          <p className="h-8 px-3 flex items-center font-display text-[12.5px] text-txt-muted">
            {query.trim() ? 'No match · a task ID + Enter fetches it' : 'No recent tasks'}
          </p>
        )}
        {lookup.state === 'loading' && <p className="h-8 px-3 flex items-center font-display text-[12.5px] text-txt-muted">Looking up…</p>}
        {lookup.state === 'error' && <p role="alert" className="h-8 px-3 flex items-center font-display text-[12.5px] text-alert truncate">{lookup.message}</p>}
      </div>
    </div>
  );
}

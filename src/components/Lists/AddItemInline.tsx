import { useState, useRef, useEffect } from 'react';
import type { ListItemColumn, TaskCache, TaskList } from '../../types';
import { useTaskSearch } from '../../hooks/useTaskSearch';
import BillableToggle from '../shared/BillableToggle';
import KeyButton from '../Timer/KeyButton';

interface AddItemInlineProps {
  listId: string;
  column: ListItemColumn;
  /** The parent list's billable default — seeds the toggle for new items. */
  defaultBillable?: boolean;
  /** Every list, for the billable default and a bound list's id. */
  lists?: TaskList[];
  /** All scope: show a list chooser (`listId` preselected). */
  chooseList?: boolean;
  onAdd: (title: string, taskId: string | null, billable: boolean, listId: string) => Promise<void>;
  onCancel: () => void;
}

type Lookup =
  | { state: 'idle' }
  | { state: 'loading'; id: string }
  | { state: 'found'; id: string; title: string }
  | { state: 'error'; id: string; message: string };

const NO_RECENTS: TaskCache[] = [];
const SUGGESTIONS = 6;
const INPUT = 'w-full px-3 py-2 bg-transparent border border-drip-border rounded-[2px] text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-focus/40 transition-colors';

/**
 * Plan's add form: a title, and optionally an Easy8 task — searched in the task
 * cache or fetched by id (Enter / leaving the field). An empty title takes the
 * issue's subject. In a list bound to a task the id field is off: the list's id wins.
 */
export default function AddItemInline({ listId, defaultBillable = true, lists, chooseList = false, onAdd, onCancel }: AddItemInlineProps) {
  const [title, setTitle] = useState('');
  const [taskId, setTaskId] = useState('');
  const [targetListId, setTargetListId] = useState(listId);
  const targetList = lists?.find(l => l.id === targetListId);
  const listBillable = targetList ? targetList.billable !== 0 : defaultBillable;
  const [billable, setBillable] = useState(listBillable);
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const lookupSeq = useRef(0);

  const boundTaskId = targetList?.task_id || null;
  const { results } = useTaskSearch(boundTaskId ? '' : taskId, NO_RECENTS);
  const suggestions = suggestOpen && taskId.trim() ? results.slice(0, SUGGESTIONS) : [];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const changeList = (id: string) => {
    setTargetListId(id);
    const next = lists?.find(l => l.id === id);
    if (next) setBillable(next.billable !== 0);
  };

  const pick = (task: TaskCache) => {
    lookupSeq.current++;
    setTaskId(task.task_id);
    setLookup({ state: 'found', id: task.task_id, title: task.title });
    setTitle(t => t.trim() ? t : task.title);
    setSuggestOpen(false);
    setHighlighted(-1);
  };

  const runLookup = async (raw: string) => {
    const id = raw.trim();
    if (!/^\d+$/.test(id)) {
      setLookup({ state: 'idle' });
      return;
    }
    if (lookup.state !== 'idle' && lookup.id === id) return;
    const seq = ++lookupSeq.current;
    setLookup({ state: 'loading', id });
    const done = (next: Lookup) => { if (lookupSeq.current === seq) setLookup(next); };
    try {
      const cached = await window.logAPI.getCachedTask(id);
      if (cached) {
        done({ state: 'found', id, title: cached.title });
        if (lookupSeq.current === seq) setTitle(t => t.trim() ? t : cached.title);
        return;
      }
      const baseUrl = (await window.timerAPI.getSettings('apiBaseUrl')) || '';
      const apiKey = (await window.timerAPI.getSettings('apiKey')) || '';
      if (!baseUrl || !apiKey || !window.timerAPI.getIssue) {
        done({ state: 'error', id, message: 'API not configured: the id is kept unchecked' });
        return;
      }
      const issue = await window.timerAPI.getIssue(baseUrl, apiKey, id);
      done({ state: 'found', id, title: issue.title });
      if (lookupSeq.current === seq) setTitle(t => t.trim() ? t : issue.title);
    } catch (error) {
      done({ state: 'error', id, message: error instanceof Error ? error.message : `Issue ${id} not found` });
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await onAdd(title.trim(), boundTaskId ? null : taskId.trim() || null, billable, targetListId);
    setTitle('');
    setTaskId('');
    setLookup({ state: 'idle' });
    setBillable(listBillable);
    inputRef.current?.focus();
  };

  const handleIdKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setHighlighted(h => e.key === 'ArrowDown' ? Math.min(h + 1, suggestions.length - 1) : Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0 && suggestions[highlighted]) pick(suggestions[highlighted]);
      else if (lookup.state === 'found' && lookup.id === taskId.trim()) void handleSubmit();
      else if (!taskId.trim()) void handleSubmit();
      else { setSuggestOpen(false); void runLookup(taskId); }
    } else if (e.key === 'Escape') {
      if (suggestions.length > 0) { e.preventDefault(); setSuggestOpen(false); }
      else onCancel();
    }
  };

  return (
    <div className="space-y-1.5" data-testid="add-task-form">
      {chooseList && lists && lists.length > 0 && (
        <select
          value={targetListId}
          onChange={e => changeList(e.target.value)}
          aria-label="Add to list"
          className="w-full h-8 px-2 bg-drip-bg border border-drip-border rounded-[2px] text-sm text-txt-primary focus:outline-none focus:border-focus/40"
        >
          {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      )}
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task name"
        aria-label="Task name"
        className={INPUT}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleSubmit();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="relative">
        <input
          value={boundTaskId ? '' : taskId}
          disabled={!!boundTaskId}
          onChange={(e) => { setTaskId(e.target.value); setSuggestOpen(true); setHighlighted(-1); if (lookup.state !== 'idle') setLookup({ state: 'idle' }); }}
          onBlur={() => { setSuggestOpen(false); void runLookup(taskId); }}
          onKeyDown={handleIdKey}
          placeholder={boundTaskId ? `logs to ${boundTaskId}` : 'Easy8 task: id or search (optional)'}
          aria-label="Easy8 task"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-autocomplete="list"
          className={`${INPUT} font-mono disabled:opacity-60 disabled:cursor-not-allowed`}
        />
        {suggestions.length > 0 && (
          <div role="listbox" aria-label="Matching tasks" className="absolute z-20 left-0 right-0 mt-1 bg-drip-elevated border border-drip-border rounded-[2px] py-1 max-h-56 overflow-auto">
            {suggestions.map((task, i) => (
              <div
                key={task.task_id}
                role="option"
                aria-selected={i === highlighted}
                onMouseEnter={() => setHighlighted(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(task); }}
                className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer ${i === highlighted ? 'bg-focus/10' : ''}`}
              >
                <span className="font-mono text-[12px] text-focus bg-focus/10 rounded-[2px] px-1.5 shrink-0">{task.task_id}</span>
                <span className="text-[13px] text-txt-primary truncate" title={task.title}>{task.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {!boundTaskId && lookup.state === 'loading' && (
        <p className="px-1 text-[11px] text-txt-muted animate-pulse">Fetching {lookup.id}…</p>
      )}
      {!boundTaskId && lookup.state === 'found' && (
        <p className="px-1 text-[11px] text-txt-muted truncate" title={lookup.title}>
          <span className="font-mono text-focus">{lookup.id}</span> {lookup.title}
        </p>
      )}
      {!boundTaskId && lookup.state === 'error' && (
        <p role="alert" className="px-1 text-[11px] text-alert">{lookup.message}</p>
      )}
      <div className="flex items-center gap-1.5 pt-0.5">
        <KeyButton variant="amber" size="sm" onClick={() => void handleSubmit()} disabled={!title.trim()} title={title.trim() ? undefined : 'Name the task first'}>
          Add
        </KeyButton>
        <KeyButton variant="text" size="sm" onClick={onCancel}>Cancel</KeyButton>
        <BillableToggle checked={billable} onChange={setBillable} size="sm" className="ml-auto" />
      </div>
    </div>
  );
}

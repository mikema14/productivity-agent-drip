import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ListItem, Subtask } from '../../types';
import BillableToggle from '../shared/BillableToggle';
import LogTimeModal, { type LogTimeMode } from './LogTimeModal';
import { useTimerStore } from '../../stores/timerStore';
import { useLogStore } from '../../stores/logStore';

interface TaskDetailInlineProps {
  item: ListItem;
  listColor: string;
  isFolderList: boolean;
  /** The parent list's own task ID, which wins over the item's (same rule as TimerTaskList). */
  listTaskId?: string | null;
  onUpdate: (id: string, updates: Partial<ListItem>) => Promise<void>;
  onClose: () => void;
}

export default function TaskDetailInline({ item, listColor, listTaskId, onUpdate, onClose }: TaskDetailInlineProps) {
  const [title, setTitle] = useState(item.title);
  const [taskId, setTaskId] = useState(item.task_id || '');
  const [description, setDescription] = useState(item.description || '');
  const [subtasks, setSubtasks] = useState<Subtask[]>(() => {
    try { return JSON.parse(item.subtasks || '[]'); } catch { return []; }
  });
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showLogModal, setShowLogModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const timerStatus = useTimerStore(s => s.status);
  const startFocus = useTimerStore(s => s.startFocus);
  const setIntention = useTimerStore(s => s.setIntention);
  const setDurationMinutes = useTimerStore(s => s.setDurationMinutes);

  // The list's task ID wins over the item's, matching TimerTaskList's resolution.
  // Use the live field values so an unsaved edit is still what gets acted on.
  const resolvedTaskId = listTaskId || taskId.trim() || null;
  const resolvedTitle = title.trim() || item.title;
  const isBillable = item.billable !== 0;
  const sessionRunning = timerStatus !== 'idle';

  const handleStartSession = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActionError(null);

    // startFocus has no guard of its own — starting over a live session would
    // silently discard its elapsed time.
    if (useTimerStore.getState().status !== 'idle') return;

    // Use the configured focus length. The store's own durationMinutes is just
    // whatever the Timer's picker was last left at, so it can't be trusted here.
    let focusMinutes = 25;
    try {
      focusMinutes = parseInt(await window.timerAPI.getSettings('pomodoroFocus') || '25', 10) || 25;
    } catch {
      // keep the 25 fallback
    }

    // Re-check after the await.
    if (useTimerStore.getState().status !== 'idle') return;

    // startFocus reads durationMinutes off the store, so set it first — this also
    // keeps the Timer view's ring and picker in agreement with the real timer.
    if (useTimerStore.getState().durationMinutes !== focusMinutes) {
      setDurationMinutes(focusMinutes);
    }

    // The intention becomes the session's comment, and it persists between
    // sessions — so always set it rather than inheriting a stale one.
    setIntention(resolvedTitle);
    await startFocus(resolvedTaskId || undefined, isBillable);

    if (useTimerStore.getState().status === 'focus') {
      window.timerAPI.showNotification('Focus session started', `${focusMinutes}m · ${resolvedTitle}`);
    } else {
      setActionError('Could not start the timer');
    }
  };

  const handleLogSubmit = async (
    mode: LogTimeMode,
    values: { durationMinutes: number; date: string; comment: string | null }
  ) => {
    const payload = {
      date: values.date,
      durationMinutes: values.durationMinutes,
      title: resolvedTitle,
      taskId: resolvedTaskId,
      comment: values.comment,
      billable: isBillable,
    };

    if (mode === 'local') {
      await useLogStore.getState().addManualEntry(payload);
      window.timerAPI.showNotification('Added to Daily Log', `${values.durationMinutes}m · ${resolvedTitle}`);
      return;
    }

    const result = await useLogStore.getState().logEntryNow(payload);
    if (!result.success) {
      throw new Error(`Saved to Daily Log, but not sent to Easy Project: ${result.error}`);
    }
    window.timerAPI.showNotification('Time logged', `${values.durationMinutes}m · task ${resolvedTaskId}`);
  };

  const saveTitle = () => {
    if (title.trim() && title !== item.title) {
      onUpdate(item.id, { title: title.trim() });
    }
  };

  const saveTaskId = () => {
    const val = taskId.trim() || null;
    if (val !== (item.task_id || null)) {
      onUpdate(item.id, { task_id: val });
    }
  };

  const saveDescription = () => {
    if (description !== (item.description || '')) {
      onUpdate(item.id, { description: description || null });
    }
  };

  const saveSubtasks = (updated: Subtask[]) => {
    setSubtasks(updated);
    onUpdate(item.id, { subtasks: JSON.stringify(updated) });
  };

  const addSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const updated = [...subtasks, { id: uuidv4(), title: newSubtaskTitle.trim(), completed: false }];
    saveSubtasks(updated);
    setNewSubtaskTitle('');
  };

  const toggleSubtask = (id: string) => {
    const updated = subtasks.map(s => s.id === id ? { ...s, completed: !s.completed } : s);
    saveSubtasks(updated);
  };

  const deleteSubtask = (id: string) => {
    const updated = subtasks.filter(s => s.id !== id);
    saveSubtasks(updated);
  };

  const doneCount = subtasks.filter(s => s.completed).length;

  return (
    <div className="mx-1 mb-2 p-3 rounded-xl bg-drip-bg/90 backdrop-blur-xl border border-focus/30 space-y-3 animate-fade-in">
      {/* Title */}
      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={e => e.key === 'Enter' && saveTitle()}
          className="flex-1 bg-transparent text-sm font-medium text-txt-primary border-b border-transparent focus:border-focus/30 outline-none transition-colors"
        />
        <button onClick={onClose} className="text-txt-muted hover:text-txt-secondary p-0.5">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M4 10l6-6M10 10L4 4" />
          </svg>
        </button>
      </div>

      {/* Task ID */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-txt-muted font-medium w-16 shrink-0">Task ID</span>
        <input
          value={taskId}
          onChange={e => setTaskId(e.target.value)}
          onBlur={saveTaskId}
          onKeyDown={e => e.key === 'Enter' && saveTaskId()}
          placeholder="e.g. 673129"
          className="flex-1 bg-transparent border border-focus/20 rounded-lg px-2 py-1 text-xs font-mono text-txt-primary placeholder-txt-dim outline-none focus:ring-1 focus:ring-focus/20 transition-all"
        />
      </div>

      {/* Description */}
      <div>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={saveDescription}
          placeholder="Add a description..."
          rows={3}
          className="w-full bg-transparent border border-focus/20 rounded-lg px-3 py-2 text-sm text-txt-primary placeholder-txt-dim resize-y outline-none focus:ring-1 focus:ring-focus/20 transition-all"
        />
      </div>

      {/* Actions + Billable — wraps rather than overflowing a narrow column */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleStartSession}
            disabled={sessionRunning}
            title={sessionRunning ? 'A session is already running — open Timer to manage it' : 'Start a focus session for this task'}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-focus/15 text-focus rounded-lg hover:bg-focus/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M2 1l7 4-7 4z" />
            </svg>
            {sessionRunning ? 'Running' : 'Start'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setActionError(null); setShowLogModal(true); }}
            title="Log time spent on this task"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-transparent border border-focus/20 text-txt-secondary rounded-lg hover:bg-focus/5 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="5" cy="5" r="4" />
              <path d="M5 3v2.2l1.5 1" />
            </svg>
            Log
          </button>
        </div>
        <BillableToggle
          checked={isBillable}
          onChange={(v) => onUpdate(item.id, { billable: v ? 1 : 0 })}
          size="sm"
        />
      </div>

      {actionError && (
        <div className="px-3 py-2 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg">
          {actionError}
        </div>
      )}

      {/* Subtasks */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-muted">
            <rect x="1" y="1" width="5" height="5" rx="1" />
            <rect x="1" y="8" width="5" height="5" rx="1" />
            <line x1="8" y1="3.5" x2="13" y2="3.5" />
            <line x1="8" y1="10.5" x2="13" y2="10.5" />
          </svg>
          <span className="text-xs text-txt-muted font-medium">
            {subtasks.length > 0 ? `${doneCount}/${subtasks.length} Subtasks` : 'Subtasks'}
          </span>
          {subtasks.length > 0 && (
            <div className="flex-1 h-1 rounded-full bg-focus/10 overflow-hidden ml-2">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${subtasks.length > 0 ? (doneCount / subtasks.length) * 100 : 0}%`, backgroundColor: listColor }}
              />
            </div>
          )}
        </div>

        <div className="space-y-0.5">
          {subtasks.map(subtask => (
            <div key={subtask.id} className="group flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-focus/5 transition-colors">
              <button
                onClick={() => toggleSubtask(subtask.id)}
                className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                  subtask.completed
                    ? 'border-transparent'
                    : 'border-focus/20 hover:border-focus/50'
                }`}
                style={subtask.completed ? { backgroundColor: listColor } : undefined}
              >
                {subtask.completed && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 5l2.5 2.5L8 3" />
                  </svg>
                )}
              </button>
              <span className={`flex-1 text-sm ${subtask.completed ? 'text-txt-muted line-through' : 'text-txt-primary'}`}>
                {subtask.title}
              </span>
              <button
                onClick={() => deleteSubtask(subtask.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-txt-muted hover:text-red-400 transition-all"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 3h8M4 3V2h4v1M5 5v4M7 5v4" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Add subtask input */}
        <div className="flex items-center gap-2 mt-1 px-2">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-dim flex-shrink-0">
            <line x1="6" y1="2" x2="6" y2="10" />
            <line x1="2" y1="6" x2="10" y2="6" />
          </svg>
          <input
            value={newSubtaskTitle}
            onChange={e => setNewSubtaskTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addSubtask(); }}
            placeholder="Add subtask..."
            className="flex-1 bg-transparent text-sm text-txt-primary placeholder-txt-dim outline-none"
          />
        </div>
      </div>

      {showLogModal && (
        <LogTimeModal
          taskTitle={resolvedTitle}
          taskId={resolvedTaskId}
          billable={isBillable}
          onClose={() => setShowLogModal(false)}
          onSubmit={handleLogSubmit}
        />
      )}
    </div>
  );
}

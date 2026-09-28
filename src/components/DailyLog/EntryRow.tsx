import { useState, useEffect, useRef, memo } from 'react';
import type { LogEntry } from '../../stores/logStore';
import type { MergedEntry } from '../../utils/mergeEntries';
import TaskIdInput from '../shared/TaskIdInput';
import BillableToggle from '../shared/BillableToggle';
import KeyButton from '../Timer/KeyButton';
import { Pill } from '../shared/Pill';
import { errorHint, rowModel } from './reviewLogic';

export interface EntryRowProps {
  entry: MergedEntry;
  onUpdate: (id: string, changes: Partial<LogEntry>) => void;
  onDelete: (id: string) => void;
  onToggleLog: (id: string) => void;
  onAccept?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onMove?: (id: string) => void;
  /** R8: saving a proposal with a task id accepts it with that id. */
  onAssignTask?: (id: string, taskId: string) => void;
  /** R7: the live Billable pill writes straight through. */
  onToggleBillable?: (id: string, billable: boolean) => void;
  /** R18: last log error for this row (server message). */
  error?: string;
  onOpenSettings?: () => void;
}

/**
 * Column template shared with the EntriesTable header: Time · Dur · Task · Comment · Billable · Log · actions.
 * The actions track is fixed at the width of the widest hover group (`Edit · Move · Delete`) so it never
 * overflows leftwards over the Log checkbox; Comment is the only track that gives way (and truncates).
 */
export const ROW_GRID = 'grid grid-cols-[52px_44px_150px_minmax(0,1fr)_84px_28px_132px] gap-3 px-4 items-center';

const INPUT = 'h-8 px-3 text-sm bg-transparent border border-drip-border rounded-[2px] text-txt-primary placeholder-txt-dim focus:outline-none focus:border-focus/40';
const ACTION = 'h-6 px-1.5 rounded-[2px] font-display text-[11.5px] text-txt-muted hover:text-txt-primary hover:bg-focus/10 transition-colors';

/** Cached title for the id pill tooltip; cache only, never the API. */
function useCachedTitle(taskId: string | null): string | null {
  const [title, setTitle] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setTitle(null);
    if (!taskId) return;
    window.logAPI.getCachedTask?.(taskId)
      .then(task => { if (alive && task) setTitle(task.title); })
      .catch(() => {});
    return () => { alive = false; };
  }, [taskId]);
  return title;
}

/**
 * One 48px Review row (mockup Review.dc.html:108-151): time · dur · dot + id ·
 * comment · Billable pill · log checkbox, hover actions in a 7th column, and
 * the inline editor of the old EntryRow when editing.
 */
function EntryRow(props: EntryRowProps) {
  const { entry, onUpdate, onDelete, onToggleLog, onAccept, onDismiss, onMove, onAssignTask, onToggleBillable, error, onOpenSettings } = props;
  const [isEditing, setIsEditing] = useState(false);
  const [focusTask, setFocusTask] = useState(false);
  const [editedEntry, setEditedEntry] = useState<MergedEntry>(entry);
  const editorRef = useRef<HTMLDivElement>(null);
  const model = rowModel(entry);
  const cachedTitle = useCachedTitle(entry.taskId);

  // Keep the edit buffer in sync with the latest entry prop. The row is memo-ized
  // and persists across reloads, so without this the buffer would be a stale
  // mount-time snapshot and Save could revert fields (e.g. billable) to old values.
  useEffect(() => {
    if (!isEditing) setEditedEntry(entry);
  }, [entry, isEditing]);

  // `Assign task` opens the editor with the task field focused (R8)
  useEffect(() => {
    if (isEditing && focusTask) {
      editorRef.current?.querySelector<HTMLInputElement>('input')?.focus();
      setFocusTask(false);
    }
  }, [isEditing, focusTask]);

  const handleTaskSelect = (taskId: string, title: string) => {
    if (entry.type === 'calendar') {
      // Keep original event name; copy it to comment if comment is empty
      setEditedEntry(prev => ({ ...prev, taskId, comment: prev.comment || prev.title }));
    } else {
      setEditedEntry(prev => ({ ...prev, taskId, title }));
    }
  };

  const handleSave = () => {
    const taskId = editedEntry.taskId?.trim() || null;
    if (entry.isProposal && taskId && onAssignTask) {
      // R8: accept + assign in one; the other fields go through the normal update first
      onUpdate(entry.id, {
        title: editedEntry.title,
        comment: editedEntry.comment,
        durationMinutes: editedEntry.durationMinutes,
        billable: editedEntry.billable,
      });
      onAssignTask(entry.id, taskId);
    } else {
      onUpdate(entry.id, {
        taskId,
        title: editedEntry.title,
        comment: editedEntry.comment,
        durationMinutes: editedEntry.durationMinutes,
        billable: editedEntry.billable,
      });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedEntry(entry);
    setIsEditing(false);
  };

  const openEditor = (focusTaskField = false) => {
    setFocusTask(focusTaskField);
    setIsEditing(true);
  };

  const isBreak = model.kind === 'break';
  const isLogged = model.kind === 'logged';
  const isProposal = model.kind === 'proposal';
  const muted = isBreak || isLogged;
  const canAssign = !entry.taskId && (model.kind === 'open' || isProposal);

  const dot = <span data-testid="entry-dot" className={`w-1.5 h-1.5 rounded-full shrink-0 ${model.dotClass}`} />;

  const editor = isEditing && (
    <div ref={editorRef} data-testid="entry-editor" className="px-4 py-3 bg-focus/5 border-y border-focus/20 flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="w-36">
          <TaskIdInput
            value={editedEntry.taskId || ''}
            onChange={(value) => setEditedEntry(prev => ({ ...prev, taskId: value }))}
            onTaskSelect={handleTaskSelect}
            placeholder="Task ID"
          />
        </div>
        <input
          type="text"
          value={editedEntry.title}
          onChange={(e) => setEditedEntry(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Title"
          aria-label="Title"
          className={`flex-1 ${INPUT}`}
        />
        <input
          type="number"
          value={editedEntry.durationMinutes}
          onChange={(e) => setEditedEntry(prev => ({ ...prev, durationMinutes: parseInt(e.target.value) || 0 }))}
          min="1"
          placeholder="Duration"
          aria-label="Duration"
          className={`w-24 ${INPUT}`}
        />
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={editedEntry.comment || ''}
          onChange={(e) => setEditedEntry(prev => ({ ...prev, comment: e.target.value }))}
          placeholder="Comment"
          aria-label="Comment"
          className={`flex-1 ${INPUT}`}
        />
        <BillableToggle
          size="sm"
          checked={editedEntry.billable ?? true}
          onChange={(v) => setEditedEntry(prev => ({ ...prev, billable: v }))}
        />
        <KeyButton variant="amber" size="sm" onClick={handleSave}>Save</KeyButton>
        <KeyButton variant="ghost" size="sm" onClick={handleCancel}>Cancel</KeyButton>
      </div>
    </div>
  );

  const hint = error ? errorHint(error) : null;

  return (
    <div
      data-testid="entry-row"
      data-kind={model.kind}
      className={`group border-b border-drip-elevated ${isProposal ? 'bg-focus/[0.04]' : ''} ${muted ? 'text-txt-muted' : 'text-txt-primary'} ${isEditing ? '' : 'hover:bg-focus/[0.03]'}`}
    >
      <div className={`${ROW_GRID} min-h-[48px]`}>
        {/* Time */}
        <span className={`font-mono text-[12px] ${entry.startTime ? 'text-txt-secondary' : 'text-txt-dim'}`}>{model.timeText}</span>

        {/* Dur */}
        <span className="font-mono text-[12px]">{model.durText}</span>

        {/* Task */}
        <span className="flex items-center gap-1.5 min-w-0">
          {dot}
          {entry.taskId ? (
            <span
              data-testid="entry-task-id"
              title={cachedTitle ?? undefined}
              className={`font-mono text-[12px] truncate ${isLogged ? 'text-txt-muted' : 'text-focus'}`}
            >
              {entry.taskId}
            </span>
          ) : canAssign ? (
            <button
              type="button"
              onClick={() => openEditor(true)}
              className="h-6 px-2 border border-dashed border-focus/45 rounded-[2px] font-display text-[12px] text-focus hover:bg-focus/10 transition-colors whitespace-nowrap"
            >
              Assign task
            </button>
          ) : !isBreak ? (
            <span className="font-display text-[11.5px] text-txt-dim">No task</span>
          ) : null}
        </span>

        {/* Comment */}
        <span className="min-w-0 flex items-center gap-2" title={model.secondaryText ? `${model.primaryText} · ${model.secondaryText}` : model.primaryText}>
          <span className="font-display text-[13.5px] truncate">
            {model.primaryText}
            {model.secondaryText && <span className="text-txt-muted"> · {model.secondaryText}</span>}
          </span>
          {entry.isMerged && (
            <span className="shrink-0 font-mono text-[10.5px] text-txt-muted border border-drip-border rounded-[2px] px-1.5 leading-4">
              {entry.sourceCount} sessions
            </span>
          )}
        </span>

        {/* Billable */}
        <span className="justify-self-start">
          {model.billableInteractive ? (
            <Pill
              pressed={model.billable}
              onClick={() => onToggleBillable?.(entry.id, !model.billable)}
              aria-label="Billable"
              title={model.billable ? 'Billable' : 'Not billable'}
              className="h-[22px] px-2 text-[11.5px] rounded-full"
            >
              Billable
            </Pill>
          ) : !isBreak ? (
            <span className="font-display text-[11.5px] text-txt-muted">{model.billable ? 'Billable' : 'Not billable'}</span>
          ) : null}
        </span>

        {/* Log */}
        <span className="flex items-center justify-center">
          {isLogged ? (
            <span className="text-break" aria-label="Logged" title="Logged to Easy Project" role="img">
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg>
            </span>
          ) : isProposal ? (
            <input type="checkbox" disabled aria-label="Log this entry (needs accepting)" className="w-4 h-4 accent-focus opacity-40" />
          ) : model.canToggle ? (
            <input
              type="checkbox"
              checked={entry.markedToLog}
              onChange={(e) => { e.stopPropagation(); onToggleLog(entry.id); }}
              aria-label="Log this entry"
              className="w-4 h-4 cursor-pointer accent-focus"
            />
          ) : null}
        </span>

        {/* Actions (hover / focus-within) */}
        <span className="row-actions flex items-center justify-end gap-0.5 whitespace-nowrap">
          {isProposal && onAccept && onDismiss && (
            <>
              <button type="button" onClick={() => onAccept(entry.id)} className={`${ACTION} text-break hover:text-break`}>Accept</button>
              <button type="button" onClick={() => onDismiss(entry.id)} className={ACTION}>Dismiss</button>
            </>
          )}
          {model.kind === 'open' && !isEditing && (
            <>
              <button type="button" onClick={() => openEditor(false)} className={ACTION}>Edit</button>
              {onMove && <button type="button" onClick={() => onMove(entry.id)} className={ACTION}>Move</button>}
              <button
                type="button"
                onClick={() => onDelete(entry.id)}
                className={`${ACTION} hover:text-alert`}
                title={entry.isMerged ? `Delete all ${entry.sourceCount} sessions` : 'Delete this entry'}
              >
                Delete
              </button>
            </>
          )}
        </span>
      </div>

      {editor}

      {error && (
        <div role="alert" className="h-6 px-4 flex items-center gap-3 font-display text-[11.5px] text-alert">
          <span className="truncate">{error}</span>
          {hint?.action === 'settings' && onOpenSettings && (
            <button type="button" onClick={onOpenSettings} className="shrink-0 underline hover:text-txt-primary">Open Settings</button>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(EntryRow, (prev, next) =>
  prev.entry.id              === next.entry.id &&
  prev.entry.source          === next.entry.source &&
  prev.entry.type            === next.entry.type &&
  prev.entry.title           === next.entry.title &&
  prev.entry.taskId          === next.entry.taskId &&
  prev.entry.startTime       === next.entry.startTime &&
  prev.entry.durationMinutes === next.entry.durationMinutes &&
  prev.entry.comment         === next.entry.comment &&
  prev.entry.billable        === next.entry.billable &&
  prev.entry.markedToLog     === next.entry.markedToLog &&
  prev.entry.logged          === next.entry.logged &&
  prev.entry.isProposal      === next.entry.isProposal &&
  prev.entry.isMerged        === next.entry.isMerged &&
  prev.entry.sourceCount     === next.entry.sourceCount &&
  prev.error                 === next.error &&
  prev.onMove                === next.onMove &&
  prev.onAssignTask          === next.onAssignTask &&
  prev.onToggleBillable      === next.onToggleBillable &&
  prev.onOpenSettings        === next.onOpenSettings
);

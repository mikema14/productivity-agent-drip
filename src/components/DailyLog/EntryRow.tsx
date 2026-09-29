import { useState, useEffect, useRef, memo } from 'react';
import type { LogEntry } from '../../stores/logStore';
import type { MergedEntry } from '../../utils/mergeEntries';
import BillableToggle from '../shared/BillableToggle';
import { useTaskName } from '../../hooks/useTaskName';
import TaskPickerPopover from './TaskPickerPopover';
import { errorHint, parseDuration, rowModel, sentComment } from './reviewLogic';

export interface EntryRowProps {
  entry: MergedEntry;
  onUpdate: (id: string, changes: Partial<LogEntry>) => void;
  /** Delete (open rows) or Dismiss (calendar rows; `deleteEntry` dismisses them). */
  onDelete: (id: string) => void;
  onToggleLog: (id: string) => void;
  /** R30: checking an unaccepted proposal that has a task accepts it. */
  onAccept?: (id: string) => void;
  onMove?: (id: string) => void;
  /** R26 / R8: a task picked in the Task cell (a proposal is accepted with it). */
  onAssignTask?: (id: string, taskId: string) => void;
  /** R7: the live Billable key writes straight through. */
  onToggleBillable?: (id: string, billable: boolean) => void;
  /** R18: last log error for this row (server message). */
  error?: string;
  onOpenSettings?: () => void;
}

/**
 * Column template shared with the EntriesTable header (mockup Review.dc.html):
 * select · Time · Dur · Task · Comment → Easy8 · Billable · actions.
 */
export const ROW_GRID = 'grid grid-cols-[28px_52px_64px_minmax(140px,180px)_minmax(0,1fr)_76px_52px] gap-3 px-4 items-center';

const CHECKBOX = 'w-4 h-4 m-0 accent-focus';
const ICON_KEY = 'w-6 h-6 flex items-center justify-center rounded-[2px] text-txt-muted hover:text-txt-primary hover:bg-focus/10 transition-colors';

/** Dur: a key that becomes an input; `45m`, `1h10`, `1:10` … (R28). */
function DurationCell({ minutes, text, editable, lockedTitle, onCommit }: {
  minutes: number; text: string; editable: boolean; lockedTitle?: string; onCommit: (minutes: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  // Closing unmounts the focused input; the ref keeps a trailing blur from committing twice (or after Esc)
  const open = useRef(false);

  const close = () => { open.current = false; setEditing(false); };
  const commit = (closeOnInvalid: boolean) => {
    if (!open.current) return;
    const next = parseDuration(draft);
    if (next === null) {
      if (closeOnInvalid) close();
      else setInvalid(true);
      return;
    }
    close();
    if (next !== minutes) onCommit(next);
  };

  if (!editable) {
    return <span className="font-mono text-[12px]" title={lockedTitle}>{text}</span>;
  }
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(text); setInvalid(false); open.current = true; setEditing(true); }}
        aria-label={`Duration ${text}`}
        title="Edit duration"
        className="justify-self-start h-[30px] px-2 bg-drip-surface border border-drip-border rounded-[2px] font-mono text-[12px] text-txt-primary hover:border-focus/40 transition-colors whitespace-nowrap"
      >
        {text}
      </button>
    );
  }
  return (
    <input
      autoFocus
      aria-label="Duration"
      aria-invalid={invalid}
      value={draft}
      onChange={e => { setDraft(e.target.value); setInvalid(false); }}
      onFocus={e => e.currentTarget.select()}
      onBlur={() => commit(true)}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); commit(false); }
        else if (e.key === 'Escape') { e.preventDefault(); close(); }
      }}
      title="45m, 1h10, 1:10"
      className={`w-full h-[30px] px-2 bg-drip-surface border rounded-[2px] font-mono text-[12px] text-txt-primary focus:outline-none ${
        invalid ? 'border-alert' : 'border-focus/40'
      }`}
    />
  );
}

/** Comment → Easy8: shows exactly what is sent; commits on blur / Enter, Esc reverts (R25). */
function CommentInput({ value, onCommit }: { value: string; onCommit: (comment: string) => void }) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  const skipCommit = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  return (
    <input
      type="text"
      aria-label="Comment"
      value={draft}
      placeholder="Comment for Easy8"
      onChange={e => setDraft(e.target.value)}
      onFocus={() => { focused.current = true; }}
      onBlur={() => {
        focused.current = false;
        if (skipCommit.current) { skipCommit.current = false; setDraft(value); return; }
        const next = draft.trim();
        if (next !== value) onCommit(next);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); skipCommit.current = true; e.currentTarget.blur(); }
      }}
      className="min-w-0 w-full h-[34px] px-2.5 bg-transparent border border-drip-border rounded-[2px] font-display text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:border-focus/40 transition-colors"
    />
  );
}

/**
 * One 56px Review row (mockup Review.dc.html): select · time · Dur key ·
 * task id + name (or `+ Assign task`) · the comment Easy8 receives · Billable
 * Yes/No · hover Move / Delete. Every field is edited in place (R25–R28).
 */
function EntryRow(props: EntryRowProps) {
  const { entry, onUpdate, onDelete, onToggleLog, onAccept, onMove, onAssignTask, onToggleBillable, error, onOpenSettings } = props;
  const [pickerOpen, setPickerOpen] = useState(false);
  const model = rowModel(entry);
  const taskName = useTaskName(entry.taskId);

  const isLogged = model.kind === 'logged';
  const isProposal = model.kind === 'proposal';
  const needsTask = !entry.taskId && !isLogged;
  const isCalendar = entry.type === 'calendar';

  const dot = <span data-testid="entry-dot" className={`w-1.5 h-1.5 rounded-full shrink-0 ${model.dotClass}`} />;

  let select;
  if (isLogged) {
    select = (
      <span className="text-break" aria-label="Logged" title="Logged to Easy8" role="img">
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg>
      </span>
    );
  } else if (needsTask) {
    select = <input type="checkbox" disabled checked={false} readOnly aria-label="Log this entry (needs a task)" title="Needs a task" className={`${CHECKBOX} opacity-40`} />;
  } else if (isProposal) {
    select = (
      <input
        type="checkbox"
        checked={false}
        onChange={() => onAccept?.(entry.id)}
        aria-label="Accept and log this entry"
        title="Calendar event: checking accepts it"
        className={`${CHECKBOX} cursor-pointer`}
      />
    );
  } else {
    select = (
      <input
        type="checkbox"
        checked={entry.markedToLog}
        onChange={() => onToggleLog(entry.id)}
        aria-label="Log this entry"
        className={`${CHECKBOX} cursor-pointer`}
      />
    );
  }

  const pick = (taskId: string) => {
    setPickerOpen(false);
    if (taskId !== entry.taskId) onAssignTask?.(entry.id, taskId);
  };

  let task;
  if (entry.taskId) {
    const content = (
      <>
        <span data-testid="entry-task-id" className={`font-mono text-[12px] ${isLogged ? 'text-txt-muted' : 'text-focus'}`}>{entry.taskId}</span>
        <span className="font-display text-[12px] text-txt-muted truncate">{taskName ?? ' '}</span>
      </>
    );
    task = isLogged ? (
      <span className="flex flex-col gap-0.5 min-w-0" title={taskName ?? undefined}>{content}</span>
    ) : (
      <button type="button" onClick={() => setPickerOpen(v => !v)} title={taskName ? `${taskName} · change task` : 'Change task'} className="flex flex-col gap-0.5 min-w-0 text-left">
        {content}
      </button>
    );
  } else {
    task = (
      <button
        type="button"
        onClick={() => setPickerOpen(v => !v)}
        className="justify-self-start h-8 px-3 border border-dashed border-focus/60 rounded-[2px] font-mono text-[10.5px] font-medium tracking-[1.2px] uppercase text-focus hover:bg-focus/10 transition-colors whitespace-nowrap"
      >
        + Assign task
      </button>
    );
  }

  const hint = error ? errorHint(error) : null;
  const deleteLabel = isCalendar ? 'Dismiss' : 'Delete';

  return (
    <div
      data-testid="entry-row"
      data-kind={model.kind}
      className={`group border-b border-drip-elevated ${needsTask ? 'bg-focus/[0.05]' : 'hover:bg-focus/[0.03]'} ${isLogged ? 'text-txt-muted opacity-70' : 'text-txt-primary'}`}
    >
      <div className={`${ROW_GRID} min-h-[56px]`}>
        <span className="flex items-center">{select}</span>

        <span className="flex items-center gap-1.5">
          {dot}
          <span className={`font-mono text-[12px] ${entry.startTime ? 'text-txt-secondary' : 'text-txt-dim'}`}>{model.timeText}</span>
        </span>

        <DurationCell
          minutes={entry.durationMinutes}
          text={model.durText}
          editable={!isLogged && !entry.isMerged}
          lockedTitle={entry.isMerged ? 'Ungroup to edit' : undefined}
          onCommit={durationMinutes => onUpdate(entry.id, { durationMinutes })}
        />

        <span className="relative flex min-w-0">
          {task}
          {pickerOpen && <TaskPickerPopover onPick={pick} onClose={() => setPickerOpen(false)} />}
        </span>

        <span className="min-w-0 flex items-center gap-2">
          {isLogged ? (
            <span className="font-display text-[13.5px] truncate" title={sentComment(entry)}>{sentComment(entry)}</span>
          ) : (
            <CommentInput value={sentComment(entry)} onCommit={comment => onUpdate(entry.id, { comment })} />
          )}
          {entry.isMerged && (
            <span className="shrink-0 font-mono text-[10.5px] text-txt-muted border border-drip-border rounded-[2px] px-1.5 leading-4">
              {entry.sourceCount} sessions
            </span>
          )}
        </span>

        <span className="justify-self-start">
          {isLogged ? (
            <span className="font-mono text-[10.5px] tracking-[1px] uppercase">{model.billable ? 'Yes' : 'No'}</span>
          ) : (
            <BillableToggle variant="yesno" checked={model.billable} onChange={v => onToggleBillable?.(entry.id, v)} />
          )}
        </span>

        <span className="row-actions flex items-center justify-end gap-1">
          {!isLogged && (
            <>
              {!isProposal && onMove && (
                <button type="button" onClick={() => onMove(entry.id)} aria-label="Move" title="Move to another day" className={ICON_KEY}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="12" height="11" rx="1" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(entry.id)}
                aria-label={deleteLabel}
                title={entry.isMerged ? `Delete all ${entry.sourceCount} sessions` : isCalendar ? 'Dismiss this event' : 'Delete this entry'}
                className={`${ICON_KEY} hover:text-alert`}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l6 6M9 3l-6 6" /></svg>
              </button>
            </>
          )}
        </span>
      </div>

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
  prev.onAccept              === next.onAccept &&
  prev.onAssignTask          === next.onAssignTask &&
  prev.onToggleBillable      === next.onToggleBillable &&
  prev.onOpenSettings        === next.onOpenSettings
);

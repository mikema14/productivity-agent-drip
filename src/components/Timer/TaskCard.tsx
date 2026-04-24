import { useRef } from 'react';
import { useTimerStore } from '../../stores/timerStore';

interface Task {
  task_id: string;
  title: string;
  project_name: string | null;
}

interface Props {
  task: Task;
  note: string;
  isReadonly: boolean;
  onReopenPicker?: () => void;
  onNoteChange?: (note: string) => void;
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

export default function TaskCard({ task, note, isReadonly, onReopenPicker, onNoteChange }: Props) {
  const { sessionCount } = useTimerStore();
  const noteInputRef = useRef<HTMLInputElement>(null);

  if (isReadonly) {
    return (
      <div
        className="rounded-[14px] overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, oklch(0.78 0.14 70 / 0.06), oklch(0.78 0.14 70 / 0.02))',
          border: '0.5px solid oklch(0.78 0.14 70 / 0.22)',
        }}
      >
        {/* Row 1: id + title + client */}
        <div className="flex items-center gap-2 px-4 py-3">
          <span
            className="font-mono text-[12px] font-medium text-focus shrink-0 rounded-full px-2 py-0.5"
            style={{ background: 'oklch(0.78 0.14 70 / 0.18)' }}
          >
            #{task.task_id}
          </span>
          <span className="text-[13.5px] font-medium text-txt-primary flex-1 truncate min-w-0">{task.title}</span>
          {task.project_name && (
            <span className="font-mono text-[11.5px] text-txt-muted shrink-0">{task.project_name}</span>
          )}
        </div>

        {note && (
          <>
            <div style={{ height: '0.5px', background: 'oklch(1 0 0 / 0.08)' }} />
            <div className="flex items-start gap-2 px-4 py-2.5">
              <NoteIcon className="text-txt-muted shrink-0 mt-0.5" />
              <p className="text-[13px] text-txt-secondary">{note}</p>
            </div>
          </>
        )}
      </div>
    );
  }

  /* Editable variant — three-zone card */
  return (
    <div
      className="rounded-[14px] overflow-hidden"
      style={{
        background: 'oklch(1 0 0 / 0.03)',
        border: '0.5px solid oklch(1 0 0 / 0.08)',
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && document.activeElement !== noteInputRef.current) {
          onReopenPicker?.();
        }
      }}
    >
      {/* Zone 1: clickable id row — click/Enter/Space opens picker */}
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          if (e.target instanceof HTMLElement && e.target.closest('input')) return;
          onReopenPicker?.();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onReopenPicker?.();
          }
        }}
        className="m-2 flex items-center gap-2 px-3 rounded-[10px] cursor-pointer hover:bg-white/[0.02] transition-colors"
        style={{
          height: 40,
          background: 'oklch(1 0 0 / 0.05)',
          border: '0.5px solid oklch(1 0 0 / 0.06)',
        }}
      >
        <span className="font-mono text-[12px] text-txt-muted shrink-0">#</span>
        <span className="font-mono text-[12px] text-focus shrink-0">{task.task_id}</span>
        <span className="font-mono text-[12px] text-txt-muted flex-1 truncate min-w-0">{task.title}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onReopenPicker?.(); }}
          className="text-txt-muted hover:text-txt-secondary transition-colors shrink-0"
          title="Change task"
        >
          <DownChevron />
        </button>
      </div>

      {/* Zone 2: note row */}
      <div className="flex items-center gap-2 px-4">
        <NoteIcon className="text-txt-muted shrink-0" />
        <input
          ref={noteInputRef}
          value={note}
          onChange={e => onNoteChange?.(e.target.value)}
          placeholder="Session note (optional)"
          className="flex-1 h-9 bg-transparent text-[13px] text-txt-primary placeholder:text-txt-muted placeholder:italic focus:outline-none"
        />
      </div>

      {/* Zone 3: meta-foot */}
      <div className="flex items-center justify-between px-4 pb-3">
        <span className="font-mono text-[11.5px] text-txt-muted">{task.project_name || ''}</span>
        <span className="text-[11.5px] text-txt-muted">
          Today<span className="text-txt-dim px-1.5">·</span>{sessionCount}/8 sessions
        </span>
      </div>
    </div>
  );
}

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
      <div className="flex flex-col gap-1.5">
        <span className="now-label text-txt-muted flex items-center gap-2">
          <span className="text-focus normal-case tracking-normal font-mono text-[12px]">{task.task_id}</span>
          {task.project_name && <span className="truncate">— {task.project_name}</span>}
        </span>
        <span className="font-display text-[22px] font-medium leading-tight tracking-[-0.3px] text-txt-primary truncate" title={task.title}>
          {task.title}
        </span>
        {note && (
          <p className="text-[13px] text-txt-secondary border-l-2 border-drip-border pl-3 mt-1">{note}</p>
        )}
      </div>
    );
  }

  /* Editable variant — three-zone card */
  return (
    <div
      className="flex flex-col gap-3"
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
        className="flex items-center gap-2 h-10 px-3 border border-drip-border rounded-[2px] cursor-pointer hover:bg-focus/5 transition-colors"
      >
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
      <input
        ref={noteInputRef}
        value={note}
        onChange={e => onNoteChange?.(e.target.value)}
        placeholder="Session note (optional)"
        aria-label="Session note"
        className="w-full h-9 px-3 bg-transparent border border-drip-border text-[13px] text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-focus/40"
      />

      {/* Zone 3: meta-foot */}
      <div className="flex items-center justify-between font-mono text-[11px] text-txt-muted">
        <span>{task.project_name || ''}</span>
        <span>
          Today<span className="text-txt-dim px-1.5">·</span>{sessionCount}/8 sessions
        </span>
      </div>
    </div>
  );
}

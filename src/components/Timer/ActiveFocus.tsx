import { useState, type RefObject } from 'react';
import CountdownDigits from './CountdownDigits';
import TickRuler from './TickRuler';
import KeyButton from './KeyButton';
import FocusReadouts from './FocusReadouts';
import type { FocusReadouts as Readouts } from './nowLogic';

export type ActiveState = 'running' | 'paused' | 'kickoff';

interface Task {
  task_id: string;
  title: string;
}

interface Props {
  state: ActiveState;
  task: Task | null;
  /** Session note / intention, shown and edited on the INTENT line. */
  note: string;
  onNoteChange: (note: string) => void;
  /** `hh:mm` the session ends at (start + total duration); moves with `+5 min`. */
  endsAt: string | null;
  /** Kickoff only: the full-session length the warmup rolls into, in minutes. */
  rollsIntoMinutes?: number;
  remainingSeconds: number;
  rulerMinutes: number;
  elapsedSeconds: number;
  /** The Timer's RAF effect writes `--progress` on this ruler root. */
  rulerRef: RefObject<HTMLDivElement>;
  readouts: Readouts;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onCancel: () => void;
  onExtend: () => void;
}

const STATE_WORD: Record<ActiveState, string> = {
  running: 'Focus',
  paused: 'Paused',
  kickoff: 'Kickoff',
};

/** INTENT line: the session note, click to edit in place (Enter / blur saves, Esc reverts). */
function IntentLine({ note, onChange }: { note: string; onChange: (note: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft !== null) {
    const commit = () => {
      onChange(draft.trim());
      setDraft(null);
    };
    return (
      <div className="mt-2 flex items-center gap-2.5">
        <span className="now-label text-txt-muted shrink-0">Intent</span>
        <input
          autoFocus
          aria-label="Session intent"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { e.preventDefault(); setDraft(null); }
          }}
          placeholder="What is this session for?"
          className="flex-1 min-w-0 h-8 px-3 text-sm bg-transparent border border-drip-border rounded-[2px] text-txt-primary placeholder:text-txt-dim focus:outline-none focus:border-focus/50"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      data-testid="intent-line"
      onClick={() => setDraft(note)}
      title="Edit the session intent"
      className="self-start max-w-full mt-2 py-0.5 flex items-baseline gap-2.5 text-left text-[15px] transition-colors hover:text-txt-primary"
    >
      <span className="now-label text-txt-muted shrink-0">Intent</span>
      {note ? (
        <span className="text-txt-secondary min-w-0 break-words">{note}</span>
      ) : (
        <span className="text-txt-dim">Add an intent for this session</span>
      )}
    </button>
  );
}

/**
 * The running card (running, paused, kickoff warmup): mono meta row (LED + state,
 * task id, hairline, ENDS), the task title and INTENT line, the countdown with its
 * ruler beside the day readouts, and one action row. Only as tall as its content.
 * Spec: `Prompts & Docs/Redesign/mockups/NowRunning.dc.html`.
 */
export default function ActiveFocus({
  state, task, note, onNoteChange, endsAt, rollsIntoMinutes, remainingSeconds, rulerMinutes, elapsedSeconds, rulerRef,
  readouts, onPause, onResume, onFinish, onCancel, onExtend,
}: Props) {
  const paused = state === 'paused';

  return (
    <>
      {/* Meta row: LED + state word · task id · hairline · ENDS hh:mm (kickoff: ROLLS INTO Nm) */}
      <div data-testid="focus-header" className="flex items-center gap-3.5 now-label text-txt-muted whitespace-nowrap">
        <span className={`flex items-center gap-2 ${paused ? '' : 'text-focus'}`}>
          <span aria-hidden className={`w-1.5 h-1.5 ${paused ? 'bg-txt-dim' : 'bg-focus shadow-led'}`} />
          <span>{STATE_WORD[state]}</span>
        </span>
        {task && <span data-testid="active-task-id">{task.task_id}</span>}
        <span aria-hidden className="flex-1 border-t border-drip-elevated" />
        {state === 'kickoff' && rollsIntoMinutes !== undefined ? (
          <span>Rolls into {rollsIntoMinutes}m</span>
        ) : endsAt ? (
          <span>Ends <span className="text-txt-primary">{endsAt}</span></span>
        ) : null}
      </div>

      {task ? (
        <h2
          data-testid="active-task-title"
          className="mt-4 mb-0 font-display text-[30px] font-medium leading-[1.2] tracking-[-0.3px] text-txt-primary line-clamp-2 break-words"
          title={task.title}
        >
          {task.title}
        </h2>
      ) : (
        <p className="mt-4 font-display text-[15px] text-txt-muted">No task attached</p>
      )}
      <IntentLine note={note} onChange={onNoteChange} />

      {/* Timer block: countdown + ruler | hairline | readouts (stacked below `wide:`) */}
      <div className="my-[30px] flex flex-col wide:flex-row gap-6 wide:gap-9">
        <div className="w-full wide:w-[400px] xwide:w-[470px] shrink-0 flex flex-col gap-[22px]">
          <CountdownDigits remainingSeconds={remainingSeconds} running={state !== 'paused'} paused={paused} size="xl" />
          <TickRuler
            ref={rulerRef}
            totalMinutes={rulerMinutes}
            elapsedSeconds={elapsedSeconds}
            dimmed={paused}
            active
          />
        </div>
        <div aria-hidden className="w-full h-px wide:w-px wide:h-auto wide:self-stretch bg-drip-elevated shrink-0" />
        <FocusReadouts {...readouts} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {paused ? (
          <KeyButton variant="light" onClick={onResume}>Resume</KeyButton>
        ) : (
          <KeyButton variant="light" onClick={onPause}>Pause</KeyButton>
        )}
        <KeyButton variant="outline" onClick={onFinish}>Finish</KeyButton>
        <span className="flex-1" />
        {!paused && (
          <KeyButton variant="text" className="px-3" onClick={onExtend}>+5 min</KeyButton>
        )}
        <KeyButton variant="text-danger" className="px-3" onClick={onCancel}>Cancel</KeyButton>
      </div>
    </>
  );
}

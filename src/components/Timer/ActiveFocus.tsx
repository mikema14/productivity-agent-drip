import type { ReactNode, RefObject } from 'react';
import CountdownDigits from './CountdownDigits';
import TickRuler from './TickRuler';
import KeyButton from './KeyButton';

export type ActiveState = 'running' | 'paused' | 'kickoff';

interface Task {
  task_id: string;
  title: string;
}

interface Props {
  state: ActiveState;
  task: Task | null;
  /** Session note / intention: the title fallback without a task, a quiet line under it with one. */
  note: string;
  /** `hh:mm` the session ends at (start + total duration); moves with `+5 min`. */
  endsAt: string | null;
  /** Kickoff only: the full-session length the warmup rolls into, in minutes. */
  rollsIntoMinutes?: number;
  remainingSeconds: number;
  rulerMinutes: number;
  elapsedSeconds: number;
  /** The Timer's RAF effect writes `--progress` on this ruler root. */
  rulerRef: RefObject<HTMLDivElement>;
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

/**
 * The calm single-column focus block while a session runs (running, paused,
 * kickoff warmup): a quiet mono header row (LED + state, task id, ENDS), the
 * task title, the countdown with its ruler, and one action row.
 * Spec: `Prompts & Docs/Redesign/mockups/Running.dc.html`.
 */
export default function ActiveFocus({
  state, task, note, endsAt, rollsIntoMinutes, remainingSeconds, rulerMinutes, elapsedSeconds, rulerRef,
  onPause, onResume, onFinish, onCancel, onExtend,
}: Props) {
  const paused = state === 'paused';

  let title: ReactNode;
  if (task) {
    title = (
      <h2
        data-testid="active-task-title"
        className="m-0 font-display text-[28px] font-medium leading-[1.2] tracking-[-0.3px] text-txt-primary truncate"
        title={task.title}
      >
        {task.title}
      </h2>
    );
  } else if (note) {
    title = <p className="text-[15px] text-txt-secondary border-l-2 border-drip-border pl-3">{note}</p>;
  } else {
    title = <p className="font-display text-[15px] text-txt-muted">No task attached</p>;
  }

  return (
    <>
      {/* Header row: LED + state word · task id · spacer · ENDS hh:mm (kickoff: ROLLS INTO Nm) */}
      <div data-testid="focus-header" className="flex items-center gap-3 now-label text-txt-muted whitespace-nowrap">
        <span className={`flex items-center gap-2 ${paused ? '' : 'text-focus'}`}>
          <span aria-hidden className={`w-1 h-1 ${paused ? 'bg-txt-dim' : 'bg-focus shadow-led'}`} />
          <span>{STATE_WORD[state]}</span>
        </span>
        {task && <span data-testid="active-task-id">{task.task_id}</span>}
        <span className="flex-1" />
        {state === 'kickoff' && rollsIntoMinutes !== undefined ? (
          <span>Rolls into {rollsIntoMinutes}m</span>
        ) : endsAt ? (
          <span>Ends <span className="text-txt-primary">{endsAt}</span></span>
        ) : null}
      </div>

      <div className="mt-3.5 min-w-0">
        {title}
        {task && note && (
          <p className="text-[13px] text-txt-secondary border-l-2 border-drip-border pl-3 mt-2">{note}</p>
        )}
      </div>

      {/* Countdown + ruler share the digits' width (full width below `wide:`, Q8) */}
      <div className="mt-6 w-full wide:w-[330px] flex flex-col gap-3">
        <CountdownDigits remainingSeconds={remainingSeconds} running={state !== 'paused'} paused={paused} />
        <TickRuler
          ref={rulerRef}
          totalMinutes={rulerMinutes}
          elapsedSeconds={elapsedSeconds}
          dimmed={paused}
          active
        />
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-2.5">
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

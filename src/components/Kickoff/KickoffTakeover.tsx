import { useCallback, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useTimerStore } from '../../stores/timerStore';
import { useTaskName } from '../../hooks/useTaskName';
import { useWindowFocus } from '../../hooks/useWindowFocus';
import KeyButton from '../Timer/KeyButton';
import { formatKickoff, progress, raycastLine, sourceLine } from './kickoffCopy';

const dragRegion = { WebkitAppRegion: 'drag' } as CSSProperties;
const noDrag = { WebkitAppRegion: 'no-drag' } as CSSProperties;

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true;
}

/**
 * Full-window takeover while a kickoff is in its warmup (mockups/Kickoff.dc.html,
 * PHASE4_PLAN.md §2.2). A fixed layer over the rail and every view (K1); the Now
 * screen keeps rendering its own kickoff state underneath (K3).
 *
 * `esc Stop` is Now's Cancel path — `reset()` + cleared note + cleared task
 * selection, no row (K2). The quiet secondary row carries the same Pause /
 * Resume / Finish / +5 min effects Now has during the warmup (K3 override), so
 * nothing that works on Now is hidden and nothing is left behind.
 */
export default function KickoffTakeover() {
  const status = useTimerStore((s) => s.status);
  const kickoff = useTimerStore((s) => s.kickoff);
  const remainingSeconds = useTimerStore((s) => s.remainingSeconds);
  const totalDuration = useTimerStore((s) => s.totalDuration);
  const currentTaskId = useTimerStore((s) => s.currentTaskId);
  const intention = useTimerStore((s) => s.intention);
  const durationMinutes = useTimerStore((s) => s.durationMinutes);
  const isPaused = useTimerStore((s) => s.isPaused);
  const raycastFocus = useTimerStore((s) => s.raycastFocus);
  const kickoffSource = useTimerStore((s) => s.kickoffSource);
  const kickoffEscalateMinutes = useTimerStore((s) => s.kickoffEscalateMinutes);
  const reset = useTimerStore((s) => s.reset);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const finishEarly = useTimerStore((s) => s.finishEarly);
  const extendSession = useTimerStore((s) => s.extendSession);
  const setIntention = useTimerStore((s) => s.setIntention);
  const clearSelection = useTimerStore((s) => s.clearSelection);

  // Exactly Now's Cancel (`doCancel`): reset, drop the session note, drop the picked task.
  const stop = useCallback(() => {
    reset();
    setIntention('');
    clearSelection();
  }, [reset, setIntention, clearSelection]);

  // Exactly Now's Finish (`handleFinish`): finishEarly, drop the picked task.
  const finish = useCallback(() => {
    finishEarly();
    clearSelection();
  }, [finishEarly, clearSelection]);

  const active = status === 'focus' && kickoff === 'warmup';
  const taskName = useTaskName(active ? currentTaskId : null);
  const windowFocused = useWindowFocus();

  // Escape = Stop, unless the user is typing somewhere (a modal input, say).
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isEditable(event.target)) return;
      event.preventDefault();
      stop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, stop]);

  if (!active) return null;

  const [mins, secs] = formatKickoff(remainingSeconds).split(':');
  const pct = Math.round(progress(remainingSeconds, totalDuration) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kickoff"
      data-testid="kickoff-takeover"
      className="fixed inset-0 z-50 bg-drip-bg flex flex-col px-12 py-10 font-display text-txt-primary animate-fade-in"
    >
      {/* Header: draggable like a title bar (hidden-inset traffic lights sit in it) */}
      <div className="flex items-center justify-between h-[34px] shrink-0" style={dragRegion}>
        <span className="now-label text-focus">Kickoff</span>
        <span
          data-testid="kickoff-raycast"
          className="flex items-center gap-2 font-display text-[12.5px] text-txt-secondary px-3 py-1.5 border border-drip-border rounded-[2px]"
          style={noDrag}
        >
          <span className={`w-1.5 h-1.5 ${raycastFocus ? 'bg-focus shadow-led' : 'bg-txt-dim'}`} />
          {raycastLine(raycastFocus)}
        </span>
      </div>

      {/* Centre: digits, task, progress, copy */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-7">
        <div
          className={`now-digits text-[160px] wide:text-[240px] leading-[0.8] tracking-[-5px] wide:tracking-[-8px] transition-colors duration-200 ${
            isPaused ? 'text-txt-secondary' : 'text-focus'
          }`}
        >
          <div role="timer" aria-label="Kickoff remaining" data-testid="kickoff-digits">
            <span>{mins}</span>
            <span className={isPaused ? '' : 'colon-blink'}>:</span>
            <span>{secs}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-[18px] text-txt-secondary min-w-0 max-w-full px-4">
          {currentTaskId ? (
            <>
              <span data-testid="kickoff-task-id" className="font-mono text-[15px] text-focus bg-focus/10 rounded-[2px] px-2 py-0.5 shrink-0">
                {currentTaskId}
              </span>
              <span className="truncate">{taskName || intention}</span>
            </>
          ) : (
            <span className="text-txt-muted">{intention || 'No task attached'}</span>
          )}
        </div>

        <div
          role="progressbar"
          aria-label="Kickoff progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-[3px] w-[520px] max-w-full bg-drip-elevated overflow-hidden"
        >
          <div
            className={`h-full transition-[width] duration-1000 ease-linear ${isPaused ? 'bg-txt-dim' : 'bg-focus'}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <p data-testid="kickoff-copy" className="text-[14px] text-txt-muted">
          {isPaused ? 'Paused — resume or stop.' : `Just start. At 0:00 this rolls into a ${durationMinutes}m focus session.`}
        </p>
      </div>

      {/* Footer: source line, the quiet secondary keys (K3 override) and esc Stop */}
      <div className="flex items-center justify-between gap-4 shrink-0 text-[12.5px] text-txt-muted">
        <span data-testid="kickoff-source">{sourceLine(kickoffSource, kickoffEscalateMinutes)}</span>
        <div className="flex items-center gap-2" style={noDrag}>
          <div data-testid="kickoff-secondary" className="flex items-center gap-1.5 opacity-60 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
            {isPaused ? (
              <KeyButton variant="ghost" size="sm" onClick={() => resume()}>Resume</KeyButton>
            ) : (
              <KeyButton variant="ghost" size="sm" onClick={() => pause()}>Pause</KeyButton>
            )}
            <KeyButton variant="ghost" size="sm" onClick={finish}>Finish</KeyButton>
            {!isPaused && (
              <KeyButton variant="ghost" size="sm" onClick={() => extendSession(5)}>+5 min</KeyButton>
            )}
          </div>
          <KeyButton variant="outline" size="sm" className="ml-2" kbd={windowFocused ? 'esc' : undefined} onClick={stop}>
            Stop
          </KeyButton>
        </div>
      </div>
    </div>
  );
}

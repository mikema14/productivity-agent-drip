import type { RefObject } from 'react';
import { formatTime } from '../../utils/time';
import TickRuler, { type RulerTone } from './TickRuler';

export const SESSIONS_PER_DAY = 8;

interface Props {
  /** Left label, e.g. `READY`, `FOCUS · 11:40 → 12:05`, `KICKOFF · ROLLS INTO 25M`. */
  label: string;
  /** Sessions completed today. */
  sessionCount: number;
  /** `next` shows `SESSION n+1/8`; `done` shows `n/8 DONE` (break). */
  sessionLabel?: 'next' | 'done';
  /** The current session's square glows (running / kickoff). */
  currentGlows?: boolean;
  remainingSeconds: number;
  /** Colon blinks. */
  running?: boolean;
  /** Digits recede, ruler fill frozen and dimmed. */
  paused?: boolean;
  tone?: RulerTone;
  /** Ruler scale in minutes. */
  rulerMinutes: number;
  elapsedSeconds: number;
  /** Baseline visible; the Timer's RAF effect writes `--progress` on `rulerRef`. */
  active?: boolean;
  rulerRef?: RefObject<HTMLDivElement>;
}

/** The left column of the focus block: label row, big digits over ghost segments, minute ruler. */
export default function CountdownDisplay({
  label, sessionCount, sessionLabel = 'next', currentGlows = false, remainingSeconds,
  running = false, paused = false, tone = 'amber', rulerMinutes, elapsedSeconds, active = false, rulerRef,
}: Props) {
  const [mins, secs] = formatTime(remainingSeconds).split(':');
  const digitColor = tone === 'emerald' ? 'text-break' : paused ? 'text-txt-secondary' : 'text-txt-primary';
  const squareOn = tone === 'emerald' ? 'bg-break' : 'bg-focus';

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between now-label text-txt-muted gap-3">
        <span className="truncate">{label}</span>
        <span className="flex items-center gap-2 shrink-0">
          {sessionLabel === 'done' ? (
            <span><span className="text-txt-primary">{sessionCount}</span>/{SESSIONS_PER_DAY} done</span>
          ) : (
            <span>Session <span className="text-txt-primary">{Math.min(sessionCount + 1, SESSIONS_PER_DAY)}</span>/{SESSIONS_PER_DAY}</span>
          )}
          <span className="flex items-center gap-[3px]" aria-hidden>
            {Array.from({ length: SESSIONS_PER_DAY }).map((_, i) => {
              const completed = i < sessionCount;
              const current = i === sessionCount && currentGlows;
              return (
                <span
                  key={i}
                  data-testid="session-square"
                  className={`w-1 h-1 ${completed || current ? squareOn : 'bg-drip-border'} ${current ? 'shadow-led' : ''}`}
                />
              );
            })}
          </span>
        </span>
      </div>

      <div className="relative now-digits -ml-1.5">
        <span aria-hidden className="absolute left-0 top-0 text-drip-ghost">88:88</span>
        <div role="timer" aria-label="Time remaining" className={`relative ${digitColor}`}>
          <span>{mins}</span>
          <span className={running ? 'colon-blink' : ''}>:</span>
          <span>{secs}</span>
        </div>
      </div>

      <TickRuler
        ref={rulerRef}
        totalMinutes={rulerMinutes}
        elapsedSeconds={elapsedSeconds}
        tone={tone}
        dimmed={paused}
        active={active}
      />
    </div>
  );
}

import type { RefObject } from 'react';
import CountdownDigits from './CountdownDigits';
import TickRuler, { type RulerTone } from './TickRuler';

export const SESSIONS_PER_DAY = 8;

interface Props {
  /** Left label, e.g. `READY`, `BREAK · 12:05 → 12:10`. */
  label: string;
  /** Sessions completed today. */
  sessionCount: number;
  /** `next` shows `SESSION n+1/8`; `done` shows `n/8 DONE` (break). */
  sessionLabel?: 'next' | 'done';
  /** The current session's square glows (running / kickoff). */
  currentGlows?: boolean;
  /**
   * Drop the `SESSION` word (`1/8` + squares) so a long label such as
   * `KICKOFF · ROLLS INTO 25M` fits the 330px column without truncating.
   */
  compactCounter?: boolean;
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

/**
 * The left column of the focus block in the ready and break states: label row
 * with the session counter, big digits over ghost segments, minute ruler.
 * Running / paused / kickoff use the single-column `ActiveFocus` instead.
 */
export default function CountdownDisplay({
  label, sessionCount, sessionLabel = 'next', currentGlows = false, compactCounter = false, remainingSeconds,
  running = false, paused = false, tone = 'amber', rulerMinutes, elapsedSeconds, active = false, rulerRef,
}: Props) {
  const squareOn = tone === 'emerald' ? 'bg-break' : 'bg-focus';

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {/* The state label has priority: it never truncates; the counter shrinks instead (compact in kickoff). */}
      <div className="flex items-center justify-between now-label text-txt-muted gap-3 whitespace-nowrap">
        <span data-testid="countdown-label" className="shrink-0">{label}</span>
        <span className="flex items-center gap-2 shrink-0">
          {sessionLabel === 'done' ? (
            <span><span className="text-txt-primary">{sessionCount}</span>/{SESSIONS_PER_DAY} done</span>
          ) : (
            <span>{!compactCounter && 'Session '}<span className="text-txt-primary">{Math.min(sessionCount + 1, SESSIONS_PER_DAY)}</span>/{SESSIONS_PER_DAY}</span>
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

      <CountdownDigits remainingSeconds={remainingSeconds} running={running} paused={paused} tone={tone} />

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

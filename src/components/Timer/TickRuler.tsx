import { forwardRef } from 'react';

export type RulerTone = 'amber' | 'emerald';

interface Props {
  /** Length of the ruler: one tick per minute. */
  totalMinutes: number;
  /** Ticks up to this point are lit. */
  elapsedSeconds: number;
  tone?: RulerTone;
  /** Frozen fill, low contrast (paused). */
  dimmed?: boolean;
  /** Baseline visible (its width is driven by the `--progress` CSS variable on the root). */
  active?: boolean;
}

/** Major tick every 5 minutes; a ruler of 5 minutes or less majors every minute. */
export function majorStep(totalMinutes: number): number {
  return totalMinutes <= 5 ? 1 : 5;
}

/** Label spacing: every 5 up to 30 min, every 10 up to 60, every 15 beyond. */
export function labelStep(totalMinutes: number): number {
  if (totalMinutes <= 5) return 1;
  if (totalMinutes <= 30) return 5;
  if (totalMinutes <= 60) return 10;
  return 15;
}

/**
 * The horizontal minute ruler under the digits. Replaces the clock ring: the
 * elapsed ticks turn amber and a 1px baseline grows along the bottom (RAF-
 * driven via `--progress`, set by the Timer on the ref'd root).
 */
const TickRuler = forwardRef<HTMLDivElement, Props>(function TickRuler(
  { totalMinutes, elapsedSeconds, tone = 'amber', dimmed = false, active = false },
  ref
) {
  const minutes = Math.max(1, Math.round(totalMinutes));
  const elapsedMinutes = Math.floor(Math.max(0, elapsedSeconds) / 60);
  const major = majorStep(minutes);
  const label = labelStep(minutes);
  const litClass = tone === 'emerald' ? 'bg-break' : 'bg-focus';
  const ticks = Array.from({ length: minutes + 1 }, (_, i) => i);
  const labels = ticks.filter(i => i % label === 0);

  return (
    <div
      ref={ref}
      aria-hidden
      data-testid="tick-ruler"
      className={`relative w-full select-none ${dimmed ? 'opacity-50' : ''}`}
      style={{ '--progress': active ? undefined : 0 } as React.CSSProperties}
    >
      <div className="flex items-end justify-between h-[18px]">
        {ticks.map(i => {
          const isMajor = i % major === 0;
          const lit = i === 0 || i < elapsedMinutes;
          return (
            <span
              key={i}
              data-tick={i}
              data-lit={lit || undefined}
              className={`${isMajor ? 'w-[2px] h-[18px]' : 'w-px h-[9px]'} ${lit ? litClass : 'bg-txt-dim'}`}
            />
          );
        })}
      </div>
      <span
        data-testid="tick-baseline"
        className={`absolute left-0 bottom-0 h-px ${litClass} ${active ? '' : 'opacity-0'}`}
        style={{ width: 'calc(var(--progress, 0) * 100%)' }}
      />
      <div className="flex justify-between font-mono text-[10px] text-txt-muted mt-1">
        {labels.map(i => (
          <span key={i} data-label={i}>{i.toString().padStart(2, '0')}</span>
        ))}
      </div>
    </div>
  );
});

export default TickRuler;

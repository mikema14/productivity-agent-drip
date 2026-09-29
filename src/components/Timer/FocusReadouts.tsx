import type { ReactNode } from 'react';
import { formatMinutesPadded } from '../Plan/boardLogic';
import { DAY_BAR_SEGMENTS, DAY_TARGET_MINUTES } from './TimerDayTimeline';
import type { FocusReadouts as Readouts } from './nowLogic';

function describeDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
  if (m > 0 || h === 0) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  return parts.join(' ');
}

function Readout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <span className="now-label text-txt-muted">{label}</span>
      {children}
    </div>
  );
}

/** Right column of the running card: TODAY · FOCUS, SESSION, ON THIS TASK TODAY. */
export default function FocusReadouts({ todayMinutes, filledSegments, completedSessions, task }: Readouts) {
  const current = completedSessions + 1;

  return (
    <div data-testid="focus-readouts" className="flex-1 min-w-0 flex flex-col gap-[26px]">
      <Readout label="Today · Focus">
        <span className="font-mono text-[22px] font-medium text-txt-primary whitespace-nowrap">
          {formatMinutesPadded(todayMinutes)} <span className="text-[13px] text-txt-muted">/ {formatMinutesPadded(DAY_TARGET_MINUTES)}</span>
        </span>
        <div
          role="img"
          aria-label={`${describeDuration(todayMinutes)} of 6 hours`}
          data-testid="day-bar"
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${DAY_BAR_SEGMENTS}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: DAY_BAR_SEGMENTS }, (_, i) => (
            <span key={i} data-filled={i < filledSegments || undefined} className={`h-1 ${i < filledSegments ? 'bg-focus' : 'bg-drip-border'}`} />
          ))}
        </div>
      </Readout>

      <Readout label="Session">
        <span className="flex items-center gap-3">
          <span data-testid="session-number" className="font-mono text-[22px] font-medium text-txt-primary">
            {current.toString().padStart(2, '0')}
          </span>
          <span aria-hidden className="flex flex-wrap gap-1">
            {Array.from({ length: current }, (_, i) => (
              <span
                key={i}
                data-testid="session-square"
                data-current={i === completedSessions || undefined}
                className={`w-2 h-2 ${i === completedSessions ? 'bg-focus shadow-led' : 'bg-txt-muted'}`}
              />
            ))}
          </span>
        </span>
      </Readout>

      {task && (
        <Readout label="On this task today">
          <span data-testid="task-readout" className="font-mono text-[22px] font-medium text-txt-primary">
            {formatMinutesPadded(task.minutes)}{' '}
            <span className="text-[13px] text-txt-muted whitespace-nowrap">· {task.sessions} session{task.sessions === 1 ? '' : 's'}</span>
          </span>
        </Readout>
      )}
    </div>
  );
}

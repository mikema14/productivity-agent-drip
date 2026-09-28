import type { CSSProperties } from 'react';
import { formatPausedUntil } from '../../utils/nudgePause';

export type NowPillState = 'ready' | 'break-due' | 'focusing' | 'paused' | 'break' | 'kickoff';

interface Props {
  state: NowPillState;
  /** Injected for tests; defaults to today. */
  date?: Date;
  /** End of the idle nudge pause (epoch ms); the muted "Nudges paused …" line shows while set. */
  nudgePausedUntil?: number | null;
  onResumeNudges?: () => void;
}

const PILL_LABEL: Record<NowPillState, string> = {
  ready: 'Ready',
  'break-due': 'Break due',
  focusing: 'Focusing',
  paused: 'Paused',
  break: 'Break',
  kickoff: 'Kickoff',
};

const dragRegion = { WebkitAppRegion: 'drag' } as CSSProperties;
const noDrag = { WebkitAppRegion: 'no-drag' } as CSSProperties;

function formatHeaderDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** 52px Now header: title, date, dot grille, state pill. Draggable like a title bar. */
export default function NowHeader({ state, date = new Date(), nudgePausedUntil = null, onResumeNudges }: Props) {
  const active = state === 'focusing' || state === 'paused' || state === 'kickoff';
  const isBreak = state === 'break';

  return (
    <header
      className="h-[52px] shrink-0 px-7 flex items-center justify-between border-b border-drip-elevated"
      style={dragRegion}
    >
      <div className="flex items-baseline gap-2.5">
        <h1 className="font-display text-[15px] font-medium text-txt-primary">Now</h1>
        <span className="font-display text-[13px] text-txt-muted">{formatHeaderDate(date)}</span>
        {nudgePausedUntil !== null && (
          <span data-testid="now-nudge-paused" className="font-display text-[12px] text-txt-muted ml-1">
            Nudges paused {formatPausedUntil(nudgePausedUntil, date.getTime())} ·{' '}
            <button
              type="button"
              onClick={onResumeNudges}
              style={noDrag}
              className="text-txt-secondary hover:text-focus transition-colors duration-150"
            >
              Resume
            </button>
          </span>
        )}
        <span
          aria-hidden
          className="self-center w-[84px] h-[14px] ml-2"
          style={{ backgroundImage: 'radial-gradient(circle, #2a2a32 1.6px, transparent 2px)', backgroundSize: '7px 7px' }}
        />
      </div>
      <span
        data-testid="now-pill"
        className={`flex items-center gap-1.5 font-display text-[12px] px-2.5 py-1 border ${
          isBreak || state === 'break-due' ? 'border-break/40 text-break'
          : active ? 'border-focus/40 text-focus'
          : 'border-drip-border text-txt-secondary'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 ${
            isBreak || state === 'break-due' ? 'bg-break'
            : state === 'focusing' ? 'bg-focus led-running'
            : active ? 'bg-focus'
            : 'bg-txt-muted'
          }`}
        />
        {PILL_LABEL[state]}
      </span>
    </header>
  );
}

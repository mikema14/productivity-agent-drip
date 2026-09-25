import type { CSSProperties } from 'react';
import { weekLabelParts } from './boardLogic';

interface Props {
  /** Injected for tests; defaults to today. */
  date?: Date;
}

const dragRegion = { WebkitAppRegion: 'drag' } as CSSProperties;

/** 52px Plan header: title + static ISO week label (P1–P3: no arrows, no Weekly review, no ⌘K). */
export default function PlanHeader({ date = new Date() }: Props) {
  const { week, range } = weekLabelParts(date);
  return (
    <header
      data-testid="plan-header"
      className="h-[52px] shrink-0 px-7 flex items-center justify-between border-b border-drip-elevated"
      style={dragRegion}
    >
      <div className="flex items-baseline gap-3">
        <h1 className="font-display text-[15px] font-medium text-txt-primary">Plan</h1>
        <span className="font-display text-[13px] text-txt-secondary">
          Week {week} · <span className="font-mono text-[12px]">{range}</span>
        </span>
      </div>
    </header>
  );
}

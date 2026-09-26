import type { ReactNode } from 'react';

export type TopRule = 'amber' | 'emerald' | 'dim';

interface Props {
  topRule: TopRule;
  /**
   * The countdown column (330px on wide windows). Omit it for the calm
   * single-column layout (running / paused / kickoff), where the children
   * own the whole block.
   */
  countdown?: ReactNode;
  /** State-dependent context: task card, duration strip, action keys. */
  children: ReactNode;
}

const RULE: Record<TopRule, string> = {
  amber: 'border-t-focus',
  emerald: 'border-t-break',
  dim: 'border-t-drip-border',
};

/** Hairline section label such as `01 FOCUS`. */
export function SectionHeader({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 now-label text-txt-muted">
      <span>{children}</span>
      <span className="flex-1 border-t border-drip-elevated" />
      {right}
    </div>
  );
}

/**
 * The bordered focus section. With a `countdown`: countdown on the left, a
 * hairline divider, context on the right. Without one: a single column.
 */
export default function FocusBlock({ topRule, countdown, children }: Props) {
  const frame = `shrink-0 px-6 py-5 border border-drip-border border-t-2 ${RULE[topRule]}`;

  if (countdown === undefined) {
    return (
      <section aria-label="Focus" data-layout="calm" className={`${frame} flex flex-col`}>
        {children}
      </section>
    );
  }

  return (
    <section
      aria-label="Focus"
      data-layout="split"
      className={`${frame} flex flex-col wide:flex-row wide:items-center gap-6`}
    >
      <div className="w-full wide:w-[330px] shrink-0">{countdown}</div>
      <div aria-hidden className="w-full h-px wide:w-px wide:h-auto wide:self-stretch bg-drip-border shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-4">{children}</div>
    </section>
  );
}

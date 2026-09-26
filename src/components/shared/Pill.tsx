import type { ReactNode } from 'react';

interface PillProps {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

/** 26px hairline toggle pill (Plan: Group by list / Done / IDs / filters; Review: Group by task, Billable, outcomes). */
export function Pill({ pressed, onClick, children, className = '', title, disabled, 'aria-label': ariaLabel }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`h-[26px] inline-flex items-center gap-1.5 px-2.5 border rounded-[2px] font-display text-[12px] transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
        pressed ? 'border-focus/30 bg-focus/10 text-txt-primary' : 'border-drip-border text-txt-secondary hover:text-txt-primary hover:bg-focus/5'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export default Pill;

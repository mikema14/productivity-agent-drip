import type { CSSProperties, ReactNode } from 'react';
import { BREAK, FOCUS, TXT } from './glass';

/**
 * Pieces shared by the overlay's cards (session-end, break-end, idle nudge,
 * kickoff prompt). Moved out of SessionEndOverlay.tsx unchanged when the idle
 * branch was extracted (Phase 4); the session-end card's look is untouched.
 */

export function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/** 12m, or 40s below a minute (DRIP_IDLE_FAST runs in seconds). */
export function span(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`;
}

export const mono: CSSProperties = {
  fontFamily: "'JetBrains Mono', Menlo, monospace",
  fontVariantNumeric: 'tabular-nums'
};

export function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="Dismiss"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        margin: '-2px -4px -2px 2px',
        padding: 0,
        border: 'none',
        background: 'transparent',
        color: TXT.dim,
        cursor: 'pointer',
        transition: 'color 150ms ease'
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = TXT.secondary)}
      onMouseLeave={(e) => (e.currentTarget.style.color = TXT.dim)}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

export function label(color: string, weight: number = 500): CSSProperties {
  return {
    fontSize: 10.5,
    fontWeight: weight,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color
  };
}

export function Dot({ color, size, breathe }: { color: string; size: number; breathe?: boolean }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 ${breathe ? 14 : 8}px ${color}cc`,
        flexShrink: 0,
        animation: breathe ? 'drip-dot 1.8s ease-in-out infinite' : undefined
      }}
    />
  );
}

export function ActionButton({
  children,
  onClick,
  primary,
  solid,
  grow,
  accent,
  escalated,
  ariaExpanded
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  /** Solid accent fill with dark text (the nudge's Start focus). Implies primary. */
  solid?: boolean;
  /** Stretch to fill the row; defaults to `primary`. */
  grow?: boolean;
  accent: { base: string; light: string; bright: string } | typeof BREAK;
  escalated?: boolean;
  /** Set when the key toggles an inline choice (the nudge's Snooze). */
  ariaExpanded?: boolean;
}) {
  const light = 'light' in accent ? accent.light : FOCUS.light;
  const bright = 'bright' in accent ? (accent as typeof FOCUS).bright : light;
  const fillAlpha = escalated ? 0.26 : 0.16;
  const borderAlpha = escalated ? 0.45 : 0.28;
  const isPrimary = primary || solid;

  const restBackground = solid ? accent.base : isPrimary ? withAlpha(accent.base, fillAlpha) : 'transparent';
  const hoverBackground = solid
    ? bright
    : isPrimary
      ? withAlpha(accent.base, fillAlpha + 0.08)
      : withAlpha(accent.base, 0.06);

  const base: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    flexGrow: (grow ?? isPrimary) ? 1 : 0,
    height: 40,
    padding: '0 14px',
    borderRadius: 13,
    fontFamily: "'Outfit', system-ui, sans-serif",
    fontSize: 13.5,
    fontWeight: solid ? 600 : isPrimary ? 500 : 400,
    cursor: 'pointer',
    outline: 'none',
    transition: 'background-color 160ms ease, border-color 160ms ease, color 160ms ease',
    background: restBackground,
    border: solid
      ? '0.5px solid transparent'
      : isPrimary
        ? `0.5px solid ${withAlpha(accent.base, borderAlpha)}`
        : `0.5px solid rgba(255,255,255,0.10)`,
    color: solid ? '#0a0a0c' : isPrimary ? (escalated ? bright : light) : TXT.secondary
  };

  return (
    <button
      onClick={onClick}
      aria-expanded={ariaExpanded}
      style={base}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hoverBackground;
        if (!isPrimary) e.currentTarget.style.color = TXT.primary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = restBackground;
        if (!isPrimary) e.currentTarget.style.color = TXT.secondary;
      }}
    >
      {children}
    </button>
  );
}

export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function CoffeeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 010 8h-1" />
      <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
      <path d="M6 2v2M10 2v2M14 2v2" />
    </svg>
  );
}

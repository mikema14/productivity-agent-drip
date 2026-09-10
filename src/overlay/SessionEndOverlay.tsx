import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type {
  BreakRunningPayload,
  FocusCompletePayload,
  BreakCompletePayload,
  OverlayActionType,
  SessionOverlayPayload
} from '../types';
import { BREAK, FOCUS, GLASS, TXT, WINDOW } from './glass';

const ESCALATE_AFTER_MS = 60_000;
const NOTE_DEBOUNCE_MS = 400;
const HOVER_LEAVE_MS = 80;

type Shape = 'pill' | 'card' | 'break';

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function clockTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function mmss(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/** Dev affordance: `?state=card` renders a state without finishing a session. */
function devPayload(): SessionOverlayPayload | null {
  const which = new URLSearchParams(window.location.search).get('state');
  if (which === 'card' || which === 'pill') {
    return {
      kind: 'focus-complete',
      sessionId: 'dev',
      taskId: '643749',
      taskTitle: 'Session-end overlay window',
      durationMinutes: 25,
      startedAt: new Date(Date.now() - 25 * 60_000).toISOString(),
      endedAt: new Date().toISOString(),
      note: '',
      nextBreakMinutes: 5,
      isLongBreak: false
    };
  }
  if (which === 'break-complete') {
    return { kind: 'break-complete', nextFocusMinutes: 25 };
  }
  if (which === 'break') {
    return { kind: 'break-running', totalSeconds: 300, remainingSeconds: 222, isLong: false };
  }
  return null;
}

export function SessionEndOverlay() {
  const initial = useMemo(devPayload, []);
  const [payload, setPayload] = useState<SessionOverlayPayload | null>(initial);
  const [expanded, setExpanded] = useState(
    () => new URLSearchParams(window.location.search).get('state') === 'card'
  );
  const [escalated, setEscalated] = useState(false);
  const [note, setNote] = useState('');
  const [remaining, setRemaining] = useState(0);

  const shapeRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const noteFocusedRef = useRef(false);
  const escalateTimer = useRef<number | null>(null);
  const noteTimer = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);
  const interactiveRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const noteRef = useRef('');
  const savedNoteRef = useRef('');

  const isBreakRunning = payload?.kind === 'break-running';
  const shape: Shape = isBreakRunning ? 'break' : expanded ? 'card' : 'pill';
  const accent = payload?.kind === 'focus-complete' ? FOCUS : BREAK;

  // ---------------------------------------------------------------- note save
  const flushNote = useCallback((immediate = false) => {
    if (noteTimer.current) {
      window.clearTimeout(noteTimer.current);
      noteTimer.current = null;
    }
    const id = sessionIdRef.current;
    const value = noteRef.current;
    if (!id || id === 'dev') return;
    if (value === savedNoteRef.current) return;
    if (!value.trim() && !savedNoteRef.current) return;

    savedNoteRef.current = value;
    void window.overlayAPI?.saveNote(id, value).catch((err) => {
      console.error('[Overlay] Failed to save note:', err);
      savedNoteRef.current = '';
    });
    if (immediate) return;
  }, []);

  const onNoteChange = useCallback(
    (value: string) => {
      setNote(value);
      noteRef.current = value;
      if (noteTimer.current) window.clearTimeout(noteTimer.current);
      noteTimer.current = window.setTimeout(() => flushNote(), NOTE_DEBOUNCE_MS);
    },
    [flushNote]
  );

  // ------------------------------------------------------------ interactivity
  const setInteractive = useCallback((value: boolean) => {
    if (interactiveRef.current === value) return;
    interactiveRef.current = value;
    window.overlayAPI?.setInteractive(value);
  }, []);

  // ---------------------------------------------------------------- lifecycle
  const stopEscalation = useCallback(() => {
    if (escalateTimer.current) {
      window.clearTimeout(escalateTimer.current);
      escalateTimer.current = null;
    }
    setEscalated(false);
  }, []);

  useEffect(() => {
    window.overlayAPI?.onState((next) => {
      setPayload(next);
      stopEscalation();

      if (next.kind === 'break-running') {
        setExpanded(false);
        setRemaining(next.remainingSeconds);
        return;
      }

      setExpanded(false);
      if (next.kind === 'focus-complete') {
        sessionIdRef.current = next.sessionId;
        noteRef.current = next.note;
        savedNoteRef.current = next.note;
        setNote(next.note);
      } else {
        sessionIdRef.current = null;
        noteRef.current = '';
        savedNoteRef.current = '';
        setNote('');
      }
      escalateTimer.current = window.setTimeout(() => setEscalated(true), ESCALATE_AFTER_MS);
    });

    window.overlayAPI?.onTick((seconds) => setRemaining(seconds));

    const onBeforeUnload = () => flushNote(true);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [flushNote, stopEscalation]);

  // Hover detection: the window is mostly empty pixels and click-through by
  // default, so ask main for mouse events only while the cursor is on the shape.
  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const rect = shapeRef.current?.getBoundingClientRect();
      if (!rect) return;
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (inside) {
        if (leaveTimer.current) {
          window.clearTimeout(leaveTimer.current);
          leaveTimer.current = null;
        }
        setInteractive(true);
        if (!isBreakRunning) {
          stopEscalation();
          setExpanded(true);
        }
        return;
      }

      // Never drop interactivity mid-word.
      if (noteFocusedRef.current) return;
      if (leaveTimer.current) return;
      leaveTimer.current = window.setTimeout(() => {
        leaveTimer.current = null;
        setInteractive(false);
        setExpanded(false);
      }, HOVER_LEAVE_MS);
    };

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [isBreakRunning, setInteractive, stopEscalation]);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const act = useCallback(
    (type: OverlayActionType) => {
      flushNote(true);
      stopEscalation();
      window.overlayAPI?.action(type);
    },
    [flushNote, stopEscalation]
  );

  if (!payload) return null;

  // ------------------------------------------------------------------- render
  const anchor: CSSProperties = {
    position: 'fixed',
    top: WINDOW.inset,
    right: WINDOW.inset,
    fontFamily: "'Outfit', system-ui, sans-serif"
  };

  const mono: CSSProperties = {
    fontFamily: "'JetBrains Mono', Menlo, monospace",
    fontVariantNumeric: 'tabular-nums'
  };

  const sheen: CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: 'inherit',
    pointerEvents: 'none',
    background: GLASS.sheen
  };

  if (shape === 'break') {
    const p = payload as BreakRunningPayload;
    const pct = p.totalSeconds > 0 ? Math.max(0, Math.min(1, remaining / p.totalSeconds)) : 0;
    return (
      <div style={anchor}>
        <div
          ref={shapeRef}
          style={{
            position: 'relative',
            width: 232,
            boxSizing: 'border-box',
            padding: '10px 14px 11px',
            borderRadius: GLASS.radiusPill,
            background: GLASS.fillCool,
            backdropFilter: GLASS.blur,
            WebkitBackdropFilter: GLASS.blur,
            border: `0.5px solid ${GLASS.hairline}`,
            boxShadow: GLASS.shadowPill
          }}
        >
          <div style={sheen} />
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Dot color={BREAK.base} size={5} />
              <span style={label(BREAK.light)}>{p.isLong ? 'Long break' : 'Break'}</span>
              <span style={{ flexGrow: 1 }} />
              <span style={{ ...mono, fontSize: 13, fontWeight: 500, color: TXT.primary, letterSpacing: '-0.01em' }}>
                {mmss(remaining)}
              </span>
            </div>
            <div style={{ height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pct * 100}%`,
                  height: '100%',
                  borderRadius: 1,
                  background: BREAK.base,
                  boxShadow: `0 0 8px ${BREAK.base}80`,
                  transition: `width 1000ms linear`
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (shape === 'pill') {
    const isFocus = payload.kind === 'focus-complete';
    const minutes = isFocus ? (payload as FocusCompletePayload).durationMinutes : null;
    return (
      <div style={anchor}>
        <div
          ref={shapeRef}
          onClick={() => setExpanded(true)}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            height: 36,
            padding: '0 14px 0 12px',
            borderRadius: GLASS.radiusPill,
            boxSizing: 'border-box',
            cursor: 'pointer',
            background: isFocus ? GLASS.fill : GLASS.fillCool,
            backdropFilter: GLASS.blur,
            WebkitBackdropFilter: GLASS.blur,
            border: `0.5px solid ${escalated ? GLASS.hairlineHot : GLASS.hairline}`,
            boxShadow: GLASS.shadowPill,
            transition: `border-color 200ms ease`
          }}
        >
          <div style={sheen} />
          <Dot color={accent.base} size={6} breathe={escalated} />
          <span style={{ fontSize: 12.5, fontWeight: 500, color: TXT.primary, letterSpacing: '-0.005em' }}>
            {isFocus ? 'Focus done' : 'Break over'}
          </span>
          {minutes !== null && (
            <span style={{ ...mono, fontSize: 11.5, color: TXT.muted }}>{minutes}m</span>
          )}
        </div>
      </div>
    );
  }

  // shape === 'card'
  const isFocus = payload.kind === 'focus-complete';
  const focus = isFocus ? (payload as FocusCompletePayload) : null;
  const breakDone = !isFocus ? (payload as BreakCompletePayload) : null;

  return (
    <div style={anchor}>
      <div style={{ position: 'relative' }}>
        {escalated && (
          <div
            style={{
              position: 'absolute',
              inset: -22,
              borderRadius: 40,
              pointerEvents: 'none',
              background: `radial-gradient(60% 60% at 50% 50%, ${accent.base}4d 0%, transparent 72%)`,
              filter: 'blur(26px)',
              animation: 'drip-halo 2.4s ease-in-out infinite'
            }}
          />
        )}
        <div
          ref={shapeRef}
          style={{
            position: 'relative',
            width: 384,
            boxSizing: 'border-box',
            padding: '16px 16px 14px',
            borderRadius: GLASS.radiusCard,
            background: isFocus ? (escalated ? GLASS.fillWarm : GLASS.fill) : GLASS.fillCool,
            backdropFilter: GLASS.blur,
            WebkitBackdropFilter: GLASS.blur,
            border: escalated ? `1px solid ${GLASS.hairlineHot}` : `0.5px solid ${GLASS.hairline}`,
            boxShadow: GLASS.shadowCard,
            transition: `border-color 200ms ease, background-color 200ms ease`
          }}
        >
          <div style={sheen} />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: escalated ? 110 : 90,
              borderRadius: `${GLASS.radiusCard}px ${GLASS.radiusCard}px 0 0`,
              pointerEvents: 'none',
              background: `radial-gradient(80% 100% at 50% 0%, ${accent.base}${escalated ? '33' : '1a'} 0%, transparent 72%)`
            }}
          />

          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Dot color={escalated ? accent.light : accent.base} size={6} />
              <span style={label(escalated ? accent.light : TXT.secondary, escalated ? 600 : 500)}>
                {isFocus ? 'Focus complete' : 'Break over'}
              </span>
              <span style={{ flexGrow: 1 }} />
              {focus && (
                <span style={{ ...mono, fontSize: 11.5, color: escalated ? FOCUS.dark : TXT.muted }}>
                  {clockTime(focus.startedAt)} – {clockTime(focus.endedAt)}
                </span>
              )}
              <button
                aria-label="Dismiss"
                onClick={() => act('dismiss')}
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
            </div>

            {focus && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
                {focus.taskId && (
                  <span style={{ ...mono, fontSize: 12.5, fontWeight: 500, color: FOCUS.base, flexShrink: 0 }}>
                    {focus.taskId}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 14,
                    color: TXT.primary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    minWidth: 0
                  }}
                >
                  {focus.taskTitle || focus.note || 'Focus session'}
                </span>
              </div>
            )}

            {focus && (
              <input
                ref={inputRef}
                type="text"
                value={note}
                placeholder="What did you get done?"
                onChange={(e) => onNoteChange(e.target.value)}
                onFocus={() => {
                  noteFocusedRef.current = true;
                  stopEscalation();
                }}
                onBlur={() => {
                  noteFocusedRef.current = false;
                  flushNote(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') act('start-break');
                  if (e.key === 'Escape') act('dismiss');
                }}
                style={{
                  boxSizing: 'border-box',
                  width: '100%',
                  height: 38,
                  padding: '0 12px',
                  borderRadius: 12,
                  border: `0.5px solid ${escalated ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.09)'}`,
                  background: escalated ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.035)',
                  color: TXT.primary,
                  fontFamily: "'Outfit', system-ui, sans-serif",
                  fontSize: 13,
                  outline: 'none',
                  transition: 'border-color 160ms ease, background-color 160ms ease'
                }}
              />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {focus ? (
                <>
                  <ActionButton primary accent={FOCUS} escalated={escalated} onClick={() => act('start-break')}>
                    <CoffeeIcon />
                    Start break
                    <span style={{ ...mono, fontSize: 11.5, opacity: 0.6 }}>{focus.nextBreakMinutes}m</span>
                  </ActionButton>
                  <ActionButton accent={FOCUS} escalated={escalated} onClick={() => act('next-focus')}>
                    Next focus
                  </ActionButton>
                </>
              ) : (
                <ActionButton primary accent={BREAK} escalated={escalated} onClick={() => act('next-focus')}>
                  Start focus
                  <span style={{ ...mono, fontSize: 11.5, opacity: 0.6 }}>{breakDone!.nextFocusMinutes}m</span>
                </ActionButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function label(color: string, weight: number = 500): CSSProperties {
  return {
    fontSize: 10.5,
    fontWeight: weight,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color
  };
}

function Dot({ color, size, breathe }: { color: string; size: number; breathe?: boolean }) {
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

function ActionButton({
  children,
  onClick,
  primary,
  accent,
  escalated
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  accent: { base: string; light: string; bright: string } | typeof BREAK;
  escalated?: boolean;
}) {
  const light = 'light' in accent ? accent.light : FOCUS.light;
  const bright = 'bright' in accent ? (accent as typeof FOCUS).bright : light;
  const fillAlpha = escalated ? 0.26 : 0.16;
  const borderAlpha = escalated ? 0.45 : 0.28;

  const base: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    flexGrow: primary ? 1 : 0,
    height: 40,
    padding: '0 14px',
    borderRadius: 13,
    fontFamily: "'Outfit', system-ui, sans-serif",
    fontSize: 13.5,
    fontWeight: primary ? 500 : 400,
    cursor: 'pointer',
    outline: 'none',
    transition: 'background-color 160ms ease, border-color 160ms ease, color 160ms ease',
    background: primary ? withAlpha(accent.base, fillAlpha) : 'transparent',
    border: primary ? `0.5px solid ${withAlpha(accent.base, borderAlpha)}` : `0.5px solid rgba(255,255,255,0.10)`,
    color: primary ? (escalated ? bright : light) : TXT.secondary
  };

  return (
    <button
      onClick={onClick}
      style={base}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = primary
          ? withAlpha(accent.base, fillAlpha + 0.08)
          : withAlpha(accent.base, 0.06);
        if (!primary) e.currentTarget.style.color = TXT.primary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = primary ? withAlpha(accent.base, fillAlpha) : 'transparent';
        if (!primary) e.currentTarget.style.color = TXT.secondary;
      }}
    >
      {children}
    </button>
  );
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function CoffeeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 010 8h-1" />
      <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
      <path d="M6 2v2M10 2v2M14 2v2" />
    </svg>
  );
}

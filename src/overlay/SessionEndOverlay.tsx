import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type {
  BreakRunningPayload,
  FocusCompletePayload,
  BreakCompletePayload,
  OverlayActionData,
  OverlayActionType,
  SessionOverlayPayload
} from '../types';
import { BREAK, CARD_W, FOCUS, GLASS, TXT, WINDOW } from './glass';
import { playEscalationChime } from './chime';
import { useOverlayHoverInteractivity } from './useOverlayHoverInteractivity';
import { useWindowFocus } from '../hooks/useWindowFocus';
import { ActionButton, CoffeeIcon, DismissButton, Dot, label, mmss, mono, pad } from './parts';
import { IdleNudgeCard } from './IdleNudgeCard';
import { KickoffPromptCard } from './KickoffPromptCard';

const ESCALATE_AFTER_MS = 60_000;
const NOTE_DEBOUNCE_MS = 400;

type Shape = 'card' | 'break';

function clockTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The idle nudge and the kickoff prompt run on main's clock, not the escalation one. */
function escalates(payload: SessionOverlayPayload): boolean {
  return payload.kind === 'focus-complete' || payload.kind === 'break-complete';
}

/** Dev affordance: `?state=card` renders a state without finishing a session. */
function devPayload(): SessionOverlayPayload | null {
  const which = new URLSearchParams(window.location.search).get('state');
  if (which === 'card') {
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
  if (which === 'idle') {
    return {
      kind: 'idle',
      idleSince: new Date(Date.now() - 12 * 60_000).toISOString(),
      kickoffAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      kickoffSeconds: 120,
      snoozeSeconds: 900,
      snoozeLongSeconds: 3600,
      escalateMinutes: 15,
      taskId: '689742',
      taskTitle: 'Automatizovať dokumentáciu',
      raycastFocus: true
    };
  }
  if (which === 'kickoff') {
    return { kind: 'kickoff-continue', focusMinutes: 25, countdownSeconds: 10 };
  }
  return null;
}

export function SessionEndOverlay() {
  const initial = useMemo(devPayload, []);
  const [payload, setPayload] = useState<SessionOverlayPayload | null>(initial);
  // The window keydown handler is registered once; it reads the kind from here.
  const kindRef = useRef<SessionOverlayPayload['kind'] | null>(initial?.kind ?? null);
  const windowFocused = useWindowFocus();

  const [escalated, setEscalated] = useState(false);
  const [note, setNote] = useState('');
  const [remaining, setRemaining] = useState(0);
  // Wall clock for the idle card's "· 12m" and the kickoff prompt's countdown
  const [now, setNow] = useState(() => Date.now());
  const [shownAt, setShownAt] = useState(() => Date.now());

  const shapeRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const noteFocusedRef = useRef(false);
  const escalateTimer = useRef<number | null>(null);
  const noteTimer = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const noteRef = useRef('');
  const savedNoteRef = useRef('');

  const isBreakRunning = payload?.kind === 'break-running';
  const shape: Shape = isBreakRunning ? 'break' : 'card';
  const accent = payload?.kind === 'focus-complete' ? FOCUS : BREAK;
  const ticking = payload?.kind === 'idle' || payload?.kind === 'kickoff-continue';

  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [ticking, payload]);

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

  // ---------------------------------------------------------------- lifecycle
  const stopEscalation = useCallback(() => {
    if (escalateTimer.current) {
      window.clearTimeout(escalateTimer.current);
      escalateTimer.current = null;
    }
    setEscalated((was) => {
      if (was) window.overlayAPI?.setEscalated(false);
      return false;
    });
  }, []);

  const escalate = useCallback(() => {
    setEscalated(true);
    // The full-width top-edge strip lives in its own window; main owns it.
    window.overlayAPI?.setEscalated(true);
    playEscalationChime();
  }, []);

  const act = useCallback(
    (type: OverlayActionType, data?: OverlayActionData) => {
      flushNote(true);
      stopEscalation();
      if (!window.overlayAPI) {
        // Dev / e2e fixture window (no preload): nothing can leave the page.
        console.log(`[Overlay] fixture action: ${type}${data ? ` ${JSON.stringify(data)}` : ''}`);
        return;
      }
      if (data === undefined) window.overlayAPI.action(type);
      else window.overlayAPI.action(type, data);
    },
    [flushNote, stopEscalation]
  );

  // Hovering the card means the user has seen it, so stop nagging.
  const onHoverEnter = useCallback(() => {
    if (!isBreakRunning) stopEscalation();
  }, [isBreakRunning, stopEscalation]);

  const { resetInteractive } = useOverlayHoverInteractivity({
    shapeRef,
    holdRef: noteFocusedRef,
    onEnter: onHoverEnter
  });

  useEffect(() => {
    window.overlayAPI?.onState((next) => {
      resetInteractive();
      noteFocusedRef.current = false;

      setPayload(next);
      kindRef.current = next.kind;
      setShownAt(Date.now());
      stopEscalation();

      if (next.kind === 'break-running') {
        setRemaining(next.remainingSeconds);
        return;
      }

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
      if (escalates(next)) escalateTimer.current = window.setTimeout(escalate, ESCALATE_AFTER_MS);
    });

    window.overlayAPI?.onTick((seconds) => setRemaining(seconds));

    const onBeforeUnload = () => flushNote(true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        flushNote(true);
        if (window.overlayAPI) window.overlayAPI.action('dismiss');
        else console.log('[Overlay] fixture action: dismiss');
        return;
      }
      // The nudge's Start focus ↵ (N3). The note input's own Enter → start-break is untouched,
      // and Enter on a focused key (Tab → Snooze → 1h) is that key's click, nothing more.
      if (event.key === 'Enter' && kindRef.current === 'idle') {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.isContentEditable)) return;
        act('idle-start-focus');
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('keydown', onKey);
    };
  }, [act, escalate, flushNote, resetInteractive, stopEscalation]);

  // Focus the note as soon as a finished session appears, so typing works
  // without hunting for the field.
  useEffect(() => {
    if (payload && payload.kind === 'focus-complete') inputRef.current?.focus();
  }, [payload]);

  if (!payload) return null;

  // ------------------------------------------------------------------- render
  const anchor: CSSProperties = {
    position: 'fixed',
    top: WINDOW.inset,
    right: WINDOW.inset,
    fontFamily: "'Outfit', system-ui, sans-serif"
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

  if (payload.kind === 'idle') {
    return (
      <div style={anchor}>
        <IdleNudgeCard payload={payload} now={now} windowFocused={windowFocused} shapeRef={shapeRef} act={act} />
      </div>
    );
  }

  if (payload.kind === 'kickoff-continue') {
    return (
      <div style={anchor}>
        <KickoffPromptCard
          payload={payload}
          secondsLeft={payload.countdownSeconds - Math.floor((now - shownAt) / 1000)}
          shapeRef={shapeRef}
          act={act}
        />
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
            width: CARD_W,
            boxSizing: 'border-box',
            padding: '16px 16px 14px',
            borderRadius: GLASS.radiusCard,
            background: isFocus ? (escalated ? GLASS.fillWarm : GLASS.fill) : GLASS.fillCool,
            backdropFilter: GLASS.blur,
            WebkitBackdropFilter: GLASS.blur,
            border: escalated ? `1px solid ${GLASS.hairlineHot}` : `0.5px solid ${GLASS.hairline}`,
            boxShadow: GLASS.shadowCard,
            animation: `drip-arrive 260ms ${GLASS.ease} both`,
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
              <DismissButton onClick={() => act('dismiss')} />
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

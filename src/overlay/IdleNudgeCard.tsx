import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from 'react';
import type { IdleNudgePayload, OverlayActionData, OverlayActionType, SnoozeChoice } from '../types';
import { ALERT, CARD_W, FOCUS, GLASS, TXT } from './glass';
import { ActionButton, DismissButton, Dot, label, mono, span, withAlpha } from './parts';
import { explain, idleFor, pauseLength, takeoverIn } from './nudgeCopy';

/**
 * The red idle nudge (mockups/Nudge.dc.html): the session-end card's red
 * sibling — same GLASS shell, plus the mockup's red hairline and halo (N1).
 * Timing and actions belong to main; this only draws the payload.
 *
 * Snooze is a choice, not one length: the key opens a quiet row of three
 * small keys (15m · 1h · Rest of day), the first one focused so Tab / Enter
 * and ← → work without aiming a mouse. Each relays `idle-snooze` with its
 * choice; main turns that into the pause.
 */
export function IdleNudgeCard({
  payload,
  now,
  windowFocused,
  shapeRef,
  act
}: {
  payload: IdleNudgePayload;
  /** Wall clock, ticked once a second by the overlay. */
  now: number;
  /** The `↵` hint is printed only while the window can receive it (N3). */
  windowFocused: boolean;
  shapeRef: RefObject<HTMLDivElement>;
  act: (type: OverlayActionType, data?: OverlayActionData) => void;
}) {
  const copy = explain(payload);
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  const choices: Array<{ choice: SnoozeChoice; text: ReactNode }> = [
    { choice: '15m', text: <span style={mono}>{pauseLength(payload.snoozeSeconds)}</span> },
    { choice: '1h', text: <span style={mono}>{pauseLength(payload.snoozeLongSeconds)}</span> },
    { choice: 'day', text: 'Rest of day' }
  ];

  const sheen: CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: 'inherit',
    pointerEvents: 'none',
    background: GLASS.sheen
  };

  return (
    <div
      ref={shapeRef}
      role="alertdialog"
      aria-label="Nothing running"
      data-testid="idle-nudge"
      style={{
        position: 'relative',
        width: CARD_W,
        boxSizing: 'border-box',
        padding: '16px 16px 14px',
        borderRadius: GLASS.radiusCard,
        background: GLASS.fill,
        backdropFilter: GLASS.blur,
        WebkitBackdropFilter: GLASS.blur,
        border: `1px solid ${withAlpha(ALERT.base, 0.45)}`,
        boxShadow: `${GLASS.shadowCard}, ${GLASS.haloAlert}`,
        animation: `drip-arrive 260ms ${GLASS.ease} both`
      }}
    >
      <div style={sheen} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 90,
          borderRadius: `${GLASS.radiusCard}px ${GLASS.radiusCard}px 0 0`,
          pointerEvents: 'none',
          background: `radial-gradient(80% 100% at 50% 0%, ${ALERT.base}26 0%, transparent 72%)`
        }}
      />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Dot color={ALERT.base} size={6} />
          <span style={label(ALERT.light, 600)}>Idle</span>
          <span style={{ flexGrow: 1 }} />
          <span style={{ ...mono, fontSize: 11.5, color: TXT.muted }}>
            takeover in{' '}
            <span data-testid="nudge-takeover" style={{ color: ALERT.light }}>
              {takeoverIn(payload.kickoffAt, now)}
            </span>
          </span>
          <DismissButton onClick={() => act('dismiss')} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span data-testid="nudge-title" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.2px', color: TXT.primary }}>
            Nothing running · <span style={{ ...mono, fontWeight: 400 }}>{idleFor(payload.idleSince, now)}</span>
          </span>
          <p data-testid="nudge-copy" style={{ margin: 0, fontSize: 13, lineHeight: 1.4, color: TXT.secondary }}>
            {copy.before}
            {copy.taskId && (
              <span style={{ ...mono, color: FOCUS.base }} title={payload.taskTitle ?? undefined}>
                {copy.taskId}
              </span>
            )}
            {copy.after}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ActionButton solid grow={false} accent={FOCUS} onClick={() => act('idle-start-focus')}>
            Start focus
            {windowFocused && (
              <kbd
                style={{
                  ...mono,
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 5,
                  background: 'rgba(10, 10, 12, 0.14)'
                }}
              >
                ↵
              </kbd>
            )}
          </ActionButton>
          <ActionButton primary grow={false} accent={FOCUS} onClick={() => act('idle-kickoff')}>
            Kickoff
            <span style={{ ...mono, fontSize: 11.5, opacity: 0.6 }}>{span(payload.kickoffSeconds)}</span>
          </ActionButton>
          <span style={{ flexGrow: 1 }} />
          <ActionButton accent={FOCUS} ariaExpanded={snoozeOpen} onClick={() => setSnoozeOpen((open) => !open)}>
            Snooze
          </ActionButton>
        </div>

        {snoozeOpen && (
          <SnoozeChoices
            choices={choices}
            onPick={(choice) => act('idle-snooze', { snooze: choice })}
          />
        )}
      </div>
    </div>
  );
}

/** The inline choice row: a label and three ghost keys, ← → between them. */
function SnoozeChoices({
  choices,
  onPick
}: {
  choices: Array<{ choice: SnoozeChoice; text: ReactNode }>;
  onPick: (choice: SnoozeChoice) => void;
}) {
  const groupRef = useRef<HTMLDivElement | null>(null);

  // Opened from the keyboard or the mouse alike, the first key takes focus so
  // Enter / ← → carry on from there (the window's Enter binding skips buttons).
  useEffect(() => {
    groupRef.current?.querySelector('button')?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const keys = Array.from(groupRef.current?.querySelectorAll('button') ?? []);
    const index = keys.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = (index + (event.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length;
    keys[next].focus();
  };

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label="Snooze for"
      data-testid="nudge-snooze-choices"
      onKeyDown={onKeyDown}
      style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: -2 }}
    >
      <span style={{ ...label(TXT.muted), marginRight: 4 }}>Snooze for</span>
      {choices.map(({ choice, text }) => (
        <ChoiceKey key={choice} onClick={() => onPick(choice)}>
          {text}
        </ChoiceKey>
      ))}
    </div>
  );
}

function ChoiceKey({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  const rest = `0.5px solid rgba(255,255,255,0.10)`;
  const lit = `0.5px solid ${withAlpha(FOCUS.base, 0.45)}`;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 28,
        padding: '0 10px',
        borderRadius: 9,
        fontFamily: "'Outfit', system-ui, sans-serif",
        fontSize: 12.5,
        fontWeight: 400,
        cursor: 'pointer',
        outline: 'none',
        transition: 'background-color 160ms ease, border-color 160ms ease, color 160ms ease',
        background: 'transparent',
        border: rest,
        color: TXT.secondary
      }}
      onFocus={(e) => {
        e.currentTarget.style.border = lit;
        e.currentTarget.style.color = TXT.primary;
      }}
      onBlur={(e) => {
        e.currentTarget.style.border = rest;
        e.currentTarget.style.color = TXT.secondary;
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = withAlpha(FOCUS.base, 0.06);
        e.currentTarget.style.color = TXT.primary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        if (document.activeElement !== e.currentTarget) e.currentTarget.style.color = TXT.secondary;
      }}
    >
      {children}
    </button>
  );
}

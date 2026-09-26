import type { CSSProperties, RefObject } from 'react';
import type { IdleNudgePayload, OverlayActionType } from '../types';
import { ALERT, CARD_W, FOCUS, GLASS, TXT } from './glass';
import { ActionButton, DismissButton, Dot, label, mono, span, withAlpha } from './parts';
import { explain, idleFor, takeoverIn } from './nudgeCopy';

/**
 * The red idle nudge (mockups/Nudge.dc.html): the session-end card's red
 * sibling — same GLASS shell, plus the mockup's red hairline and halo (N1).
 * Timing and actions belong to main; this only draws the payload.
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
  act: (type: OverlayActionType) => void;
}) {
  const copy = explain(payload);

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
          <ActionButton accent={FOCUS} onClick={() => act('idle-snooze')}>
            Snooze
            <span style={{ ...mono, fontSize: 11.5, opacity: 0.6 }}>{span(payload.snoozeSeconds)}</span>
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

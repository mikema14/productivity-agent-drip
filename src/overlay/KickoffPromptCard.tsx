import type { CSSProperties, RefObject } from 'react';
import type { KickoffContinuePayload, OverlayActionType } from '../types';
import { CARD_W, FOCUS, GLASS, TXT } from './glass';
import { ActionButton, DismissButton, Dot, label, mmss, mono } from './parts';

/**
 * The kickoff roll-over prompt (`Kickoff done` · Keep going / Stop). Extracted
 * verbatim from SessionEndOverlay.tsx in Phase 4 (K8): no restyle. The 10 s
 * timeout and what each key does live in main (electron/idleNudge.ts).
 */
export function KickoffPromptCard({
  payload,
  secondsLeft,
  shapeRef,
  act
}: {
  payload: KickoffContinuePayload;
  secondsLeft: number;
  shapeRef: RefObject<HTMLDivElement>;
  act: (type: OverlayActionType) => void;
}) {
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
      data-testid="kickoff-prompt"
      style={{
        position: 'relative',
        width: CARD_W,
        boxSizing: 'border-box',
        padding: '16px 16px 14px',
        borderRadius: GLASS.radiusCard,
        background: GLASS.fill,
        backdropFilter: GLASS.blur,
        WebkitBackdropFilter: GLASS.blur,
        border: `0.5px solid ${GLASS.hairline}`,
        boxShadow: GLASS.shadowCard,
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
          background: `radial-gradient(80% 100% at 50% 0%, ${FOCUS.base}26 0%, transparent 72%)`
        }}
      />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Dot color={FOCUS.base} size={6} />
          <span style={label(TXT.secondary)}>Kickoff done</span>
          <span style={{ flexGrow: 1 }} />
          <span style={{ ...mono, fontSize: 11.5, color: TXT.muted }}>{mmss(Math.max(0, secondsLeft))}</span>
          <DismissButton onClick={() => act('dismiss')} />
        </div>
        <span style={{ fontSize: 14, color: TXT.primary }}>
          Rolling into <span style={mono}>{payload.focusMinutes}m</span> focus.
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ActionButton primary accent={FOCUS} onClick={() => act('kickoff-keep')}>
            Keep going
          </ActionButton>
          <ActionButton accent={FOCUS} onClick={() => act('kickoff-stop')}>
            Stop
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { FOCUS } from './glass';

/**
 * A breathing amber strip along the full top edge of the display, shown once a
 * finished session has gone unattended.
 *
 * The corner card can be overlooked for minutes — a small static object near
 * the edge of a large display is exactly what peripheral vision filters out.
 * Full-width motion in the far periphery is not.
 *
 * Rendered into its own always-on-top, never-interactive window (overlay.html
 * with ?edge=1), so it covers no content and swallows no clicks.
 */
export function EdgeGlow() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade in rather than appearing instantly — motion is the whole point.
    const id = window.setTimeout(() => setVisible(true), 40);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 400ms ease'
      }}
    >
      {/* The bloom below the bar, which is what actually catches the eye */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: '100%',
          background: `linear-gradient(to bottom, ${FOCUS.base}59 0%, ${FOCUS.base}00 78%)`,
          animation: 'drip-edge 2.4s ease-in-out infinite'
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 4,
          background: `linear-gradient(to right, ${FOCUS.dark} 0%, ${FOCUS.light} 50%, ${FOCUS.dark} 100%)`,
          boxShadow: `0 0 16px ${FOCUS.base}, 0 0 32px ${FOCUS.base}80`,
          animation: 'drip-edge 2.4s ease-in-out infinite'
        }}
      />
    </div>
  );
}

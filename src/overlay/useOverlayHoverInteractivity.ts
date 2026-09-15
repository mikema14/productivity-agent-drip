import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const HOVER_LEAVE_MS = 80;

/**
 * The overlay window is mostly empty pixels and click-through by default, so it
 * asks main for mouse events only while the cursor is over the visible shape.
 *
 * `holdRef` keeps interactivity while it reads true (the note field is focused —
 * dropping it mid-word would swallow keystrokes).
 */
export function useOverlayHoverInteractivity({
  shapeRef,
  holdRef,
  onEnter
}: {
  shapeRef: RefObject<HTMLElement | null>;
  holdRef?: RefObject<boolean>;
  onEnter?: () => void;
}): { resetInteractive: () => void } {
  const interactiveRef = useRef(false);
  const leaveTimer = useRef<number | null>(null);

  const setInteractive = useCallback((value: boolean) => {
    if (interactiveRef.current === value) return;
    interactiveRef.current = value;
    window.overlayAPI?.setInteractive(value);
  }, []);

  // main sets the window back to click-through when it hides the overlay, so
  // the cached value has to be dropped or the next hover is deduped away and
  // clicks never reach the overlay again.
  const resetInteractive = useCallback(() => {
    interactiveRef.current = false;
  }, []);

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
        onEnter?.();
        return;
      }

      if (holdRef?.current) return;
      if (leaveTimer.current) return;
      leaveTimer.current = window.setTimeout(() => {
        leaveTimer.current = null;
        // Release mouse events so the empty area around the card stays
        // click-through. The card itself stays up.
        setInteractive(false);
      }, HOVER_LEAVE_MS);
    };

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [holdRef, onEnter, setInteractive, shapeRef]);

  return { resetInteractive };
}

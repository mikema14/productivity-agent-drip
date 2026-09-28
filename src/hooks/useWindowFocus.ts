import { useEffect, useState } from 'react';

/**
 * Whether this window has keyboard focus. Both the overlay and the main window
 * are raised with `showInactive()` by design, so a printed `↵` / `esc` hint is
 * only honest while the window is focused (PHASE4_PLAN.md N3). The key
 * bindings themselves exist regardless.
 */
export function useWindowFocus(): boolean {
  const [focused, setFocused] = useState(() => typeof document !== 'undefined' && document.hasFocus());

  useEffect(() => {
    const onFocus = () => setFocused(true);
    const onBlur = () => setFocused(false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    setFocused(document.hasFocus());
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return focused;
}

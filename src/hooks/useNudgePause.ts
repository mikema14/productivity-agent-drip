import { useCallback, useEffect, useState } from 'react';

/**
 * The idle nudge pause as main sees it: the end of the current pause (epoch
 * ms) or null. Read once on mount, then followed through `idle-nudge-paused`.
 * `resume` asks main to end it now; the answer comes back through the same
 * event. Safe without the bridge (tests, old preload): stays null.
 */
export function useNudgePause(): { pausedUntil: number | null; resume: () => void } {
  const [pausedUntil, setPausedUntil] = useState<number | null>(null);

  useEffect(() => {
    const api = window.timerAPI;
    if (!api) return;
    let alive = true;
    void api.getIdleNudgePause?.()
      .then((until) => {
        if (alive) setPausedUntil(until);
      })
      .catch(() => {});
    const unsubscribe = api.onIdleNudgePauseChanged?.((until) => setPausedUntil(until));
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);

  const resume = useCallback(() => {
    void window.timerAPI?.resumeIdleNudges?.().catch((error) => {
      console.error('[Now] Failed to resume nudges:', error);
    });
  }, []);

  return { pausedUntil, resume };
}

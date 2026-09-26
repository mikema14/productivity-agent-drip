import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useNudgePause } from './useNudgePause';

describe('useNudgePause', () => {
  it('starts null, reads main once, then follows idle-nudge-paused', async () => {
    let push: ((until: number | null) => void) | null = null;
    const unsubscribe = vi.fn();
    window.timerAPI.getIdleNudgePause = vi.fn(async () => 1_000);
    window.timerAPI.onIdleNudgePauseChanged = vi.fn((cb) => {
      push = cb;
      return unsubscribe;
    });

    const { result, unmount } = renderHook(() => useNudgePause());
    expect(result.current.pausedUntil).toBeNull();
    await waitFor(() => expect(result.current.pausedUntil).toBe(1_000));

    act(() => push?.(2_000));
    expect(result.current.pausedUntil).toBe(2_000);
    act(() => push?.(null));
    expect(result.current.pausedUntil).toBeNull();

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('resume asks main; the state only changes when the event comes back', async () => {
    window.timerAPI.getIdleNudgePause = vi.fn(async () => 5_000);
    const { result } = renderHook(() => useNudgePause());
    await waitFor(() => expect(result.current.pausedUntil).toBe(5_000));
    act(() => result.current.resume());
    expect(window.timerAPI.resumeIdleNudges).toHaveBeenCalledTimes(1);
    expect(result.current.pausedUntil).toBe(5_000);
  });

  it('is inert without the bridge methods (old preload)', async () => {
    window.timerAPI.getIdleNudgePause = undefined;
    window.timerAPI.onIdleNudgePauseChanged = undefined;
    window.timerAPI.resumeIdleNudges = undefined;
    const { result } = renderHook(() => useNudgePause());
    act(() => result.current.resume());
    expect(result.current.pausedUntil).toBeNull();
  });
});

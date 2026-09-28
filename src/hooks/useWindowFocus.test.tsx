import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWindowFocus } from './useWindowFocus';

describe('useWindowFocus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts from document.hasFocus() and follows window focus / blur', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    const { result } = renderHook(() => useWindowFocus());
    expect(result.current).toBe(false);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current).toBe(true);
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(result.current).toBe(false);
  });

  it('reads true when the document already has focus', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    const { result } = renderHook(() => useWindowFocus());
    expect(result.current).toBe(true);
  });
});

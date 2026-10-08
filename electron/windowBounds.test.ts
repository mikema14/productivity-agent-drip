import { describe, expect, it } from 'vitest';
import { recoverBounds } from './windowBounds';

const DELL = { x: 0, y: 25, width: 2560, height: 1415 };
const LAPTOP = { x: -1512, y: 395, width: 1512, height: 949 };
const FALLBACK = { width: 1200, height: 800, minWidth: 800, minHeight: 600 };

describe('recoverBounds', () => {
  it('leaves a window that is on a display alone', () => {
    expect(recoverBounds({ x: 680, y: 264, width: 1200, height: 800 }, [DELL, LAPTOP], FALLBACK)).toBeNull();
    expect(recoverBounds({ x: -1400, y: 400, width: 1200, height: 800 }, [DELL, LAPTOP], FALLBACK)).toBeNull();
  });

  it('restores a 0×0 window to the default size on the primary display', () => {
    expect(recoverBounds({ x: 0, y: 1440, width: 0, height: 0 }, [DELL, LAPTOP], FALLBACK)).toEqual({
      x: 680, y: 333, width: 1200, height: 800,
    });
  });

  it('brings back a window left off every display, keeping its size', () => {
    expect(recoverBounds({ x: -5000, y: 0, width: 2560, height: 1440 }, [DELL, LAPTOP], FALLBACK)).toEqual({
      x: 0, y: 25, width: 2560, height: 1415,
    });
  });

  it('treats a sliver on screen as unreachable', () => {
    expect(recoverBounds({ x: 2540, y: 300, width: 1200, height: 800 }, [DELL], FALLBACK)).not.toBeNull();
  });

  it('does nothing without displays', () => {
    expect(recoverBounds({ x: 0, y: 0, width: 0, height: 0 }, [], FALLBACK)).toBeNull();
  });
});

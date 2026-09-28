import { describe, expect, it } from 'vitest';
import { formatPausedUntil } from './nudgePause';

const WED_10 = new Date(2026, 8, 23, 10, 0).getTime();

describe('formatPausedUntil', () => {
  it('same local day → until HH:MM, zero-padded', () => {
    expect(formatPausedUntil(new Date(2026, 8, 23, 14, 30).getTime(), WED_10)).toBe('until 14:30');
    expect(formatPausedUntil(new Date(2026, 8, 23, 9, 5).getTime(), WED_10)).toBe('until 09:05');
  });

  it('a later local day → until tomorrow (rest of day after work hours, or read back after midnight)', () => {
    expect(formatPausedUntil(new Date(2026, 8, 24, 0, 0).getTime(), WED_10)).toBe('until tomorrow');
    expect(formatPausedUntil(new Date(2026, 8, 24, 18, 0).getTime(), WED_10)).toBe('until tomorrow');
  });
});

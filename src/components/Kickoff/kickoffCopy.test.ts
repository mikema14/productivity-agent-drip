import { describe, expect, it } from 'vitest';
import { formatKickoff, progress, raycastLine, sourceLine } from './kickoffCopy';

describe('kickoffCopy.sourceLine', () => {
  it('names each source', () => {
    expect(sourceLine('auto', 15)).toBe('Started automatically after 15m idle');
    expect(sourceLine('auto', 1)).toBe('Started automatically after 1m idle');
    expect(sourceLine('nudge', 15)).toBe('Started from the nudge');
    expect(sourceLine('deeplink', 15)).toBe('Started from Raycast');
    expect(sourceLine('now', null)).toBe('Started from Now');
    expect(sourceLine(null, null)).toBe('Started from Now');
  });

  it('an auto kickoff without a known escalation time drops the number', () => {
    expect(sourceLine('auto', null)).toBe('Started automatically');
  });
});

describe('kickoffCopy.raycastLine', () => {
  it('spells the shared block categories when on, and says off otherwise', () => {
    expect(raycastLine(true)).toBe('Raycast Focus on · social, streaming, gaming blocked');
    expect(raycastLine(false)).toBe('Raycast Focus off');
  });
});

describe('kickoffCopy.formatKickoff', () => {
  it('formats m:ss without a leading minute zero', () => {
    expect(formatKickoff(97)).toBe('1:37');
    expect(formatKickoff(120)).toBe('2:00');
    expect(formatKickoff(5)).toBe('0:05');
    expect(formatKickoff(-3)).toBe('0:00');
  });
});

describe('kickoffCopy.progress', () => {
  it('is the elapsed share, clamped', () => {
    expect(progress(97, 120)).toBeCloseTo(0.1917, 3);
    expect(progress(120, 120)).toBe(0);
    expect(progress(0, 120)).toBe(1);
    expect(progress(-5, 120)).toBe(1);
    expect(progress(10, 0)).toBe(0);
  });
});

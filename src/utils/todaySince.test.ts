import { describe, it, expect } from 'vitest';
import { todaySinceFor } from './todaySince';

describe('todaySinceFor (R29)', () => {
  it('stamps today when an item enters Today, from any column or on create', () => {
    expect(todaySinceFor('backlog', 'today', null, '2026-09-29')).toBe('2026-09-29');
    expect(todaySinceFor('this_week', 'today', '2026-09-01', '2026-09-29')).toBe('2026-09-29');
    expect(todaySinceFor(null, 'today', undefined, '2026-09-29')).toBe('2026-09-29');
  });

  it('keeps the date while the item stays in Today (reorder)', () => {
    expect(todaySinceFor('today', 'today', '2026-09-24', '2026-09-29')).toBe('2026-09-24');
    expect(todaySinceFor('today', 'today', null, '2026-09-29')).toBeNull();
  });

  it('clears it when the item leaves Today', () => {
    expect(todaySinceFor('today', 'backlog', '2026-09-24', '2026-09-29')).toBeNull();
    expect(todaySinceFor('today', 'this_week', '2026-09-24', '2026-09-29')).toBeNull();
    expect(todaySinceFor(null, 'backlog', undefined, '2026-09-29')).toBeNull();
  });
});

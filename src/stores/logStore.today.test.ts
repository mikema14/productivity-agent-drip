import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/calendar', () => ({
  syncCalendarProposals: vi.fn(async () => undefined),
  forceSyncCalendar: vi.fn(async () => undefined),
  invalidateCalendarCache: vi.fn(),
  getLastSyncTime: vi.fn(() => null),
}));

/**
 * The store's boot `selectedDate` (what Review opens on, R1) is the local
 * calendar day. Imported fresh under a fake clock at 00:30 CEST, where the
 * UTC date is still the day before.
 */
describe('logStore — initial selectedDate is the local date', () => {
  const previousTZ = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = 'Europe/Prague';
    vi.useFakeTimers({ now: new Date(2026, 8, 26, 0, 30, 0) });
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = previousTZ;
  });

  it('boots on 2026-09-26 at 00:30 local, not the UTC 25th', async () => {
    expect(new Date().toISOString().split('T')[0]).toBe('2026-09-25');
    const { useLogStore } = await import('./logStore');
    expect(useLogStore.getState().selectedDate).toBe('2026-09-26');
  });
});

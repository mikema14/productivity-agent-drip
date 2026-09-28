import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useIntentionsStore } from './intentionsStore';

describe('intentionsStore', () => {
  beforeEach(() => {
    useIntentionsStore.setState({ intentions: new Map() });
    window.dashboardAPI.setDailyIntentions = vi.fn(async () => undefined);
  });

  it('adding to an unread day reads it first, so existing intentions survive (End day → tomorrow)', async () => {
    window.dashboardAPI.getDailyIntentions = vi.fn(async (date: string) => ({ date, intentions: ['Already there'] }));
    await useIntentionsStore.getState().addIntention('2026-09-29', 'New one');
    expect(window.dashboardAPI.setDailyIntentions).toHaveBeenCalledWith('2026-09-29', ['Already there', 'New one']);
  });

  it('a load that resolves after an add does not overwrite it', async () => {
    let resolveSlow: (v: { date: string; intentions: string[] }) => void = () => {};
    window.dashboardAPI.getDailyIntentions = vi.fn()
      .mockImplementationOnce(() => new Promise(r => { resolveSlow = r; }))
      .mockImplementation(async (date: string) => ({ date, intentions: [] }));
    const slowLoad = useIntentionsStore.getState().loadDay('2026-09-28');
    await useIntentionsStore.getState().addIntention('2026-09-28', 'Ship GDI scope');
    resolveSlow({ date: '2026-09-28', intentions: [] });
    await slowLoad;
    expect(useIntentionsStore.getState().getIntentions('2026-09-28')).toEqual(['Ship GDI scope']);
  });

  it('a failed save rejects and leaves the day unchanged', async () => {
    useIntentionsStore.setState({ intentions: new Map([['2026-09-28', []]]) });
    window.dashboardAPI.setDailyIntentions = vi.fn(async () => { throw new Error('ipc'); });
    await expect(useIntentionsStore.getState().addIntention('2026-09-28', 'x')).rejects.toThrow('ipc');
    expect(useIntentionsStore.getState().getIntentions('2026-09-28')).toEqual([]);
  });
});

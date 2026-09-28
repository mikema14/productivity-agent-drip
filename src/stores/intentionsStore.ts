import { create } from 'zustand';
import type { DailyIntentions } from '../types';

interface IntentionsState {
  intentions: Map<string, string[]>;  // date -> intentions[]
  isLoading: boolean;

  // Actions
  loadDay: (date: string) => Promise<void>;
  addIntention: (date: string, text: string) => Promise<void>;
  removeIntention: (date: string, index: number) => Promise<void>;
  getIntentions: (date: string) => string[];
}

/** Per-date write counter: a load that started before a write must not overwrite it. */
const writes = new Map<string, number>();

export const useIntentionsStore = create<IntentionsState>((set, get) => ({
  intentions: new Map(),
  isLoading: false,

  loadDay: async (date: string) => {
    set({ isLoading: true });
    const writesAtStart = writes.get(date) ?? 0;
    try {
      const data = await window.dashboardAPI.getDailyIntentions(date);
      if ((writes.get(date) ?? 0) !== writesAtStart) return;
      const intentionsMap = new Map(get().intentions);
      intentionsMap.set(date, data?.intentions || []);
      set({ intentions: intentionsMap });
    } catch (error) {
      console.error('[Intentions] Failed to load', date, error);
    } finally {
      set({ isLoading: false });
    }
  },

  addIntention: async (date: string, text: string) => {
    // Never write over a day we have not read (End day targets tomorrow).
    if (!get().intentions.has(date)) await get().loadDay(date);
    const current = get().getIntentions(date);

    // Soft limit: 3 items (user can override, just warn)
    if (current.length >= 3) {
      console.warn('Recommended max 3 intentions per day');
    }

    const updated = [...current, text];
    writes.set(date, (writes.get(date) ?? 0) + 1);
    await window.dashboardAPI.setDailyIntentions(date, updated);

    const newMap = new Map(get().intentions);
    newMap.set(date, updated);
    set({ intentions: newMap });
  },

  removeIntention: async (date: string, index: number) => {
    const current = get().getIntentions(date);
    const updated = current.filter((_, i) => i !== index);

    writes.set(date, (writes.get(date) ?? 0) + 1);
    await window.dashboardAPI.setDailyIntentions(date, updated);

    const newMap = new Map(get().intentions);
    newMap.set(date, updated);
    set({ intentions: newMap });
  },

  getIntentions: (date: string) => {
    return get().intentions.get(date) || [];
  }
}));

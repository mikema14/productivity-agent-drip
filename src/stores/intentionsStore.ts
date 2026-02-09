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

export const useIntentionsStore = create<IntentionsState>((set, get) => ({
  intentions: new Map(),
  isLoading: false,

  loadDay: async (date: string) => {
    set({ isLoading: true });
    try {
      const data = await window.dashboardAPI.getDailyIntentions(date);
      const intentionsMap = new Map(get().intentions);
      intentionsMap.set(date, data?.intentions || []);
      set({ intentions: intentionsMap });
    } finally {
      set({ isLoading: false });
    }
  },

  addIntention: async (date: string, text: string) => {
    const current = get().getIntentions(date);

    // Soft limit: 3 items (user can override, just warn)
    if (current.length >= 3) {
      console.warn('Recommended max 3 intentions per day');
    }

    const updated = [...current, text];
    await window.dashboardAPI.setDailyIntentions(date, updated);

    const newMap = new Map(get().intentions);
    newMap.set(date, updated);
    set({ intentions: newMap });
  },

  removeIntention: async (date: string, index: number) => {
    const current = get().getIntentions(date);
    const updated = current.filter((_, i) => i !== index);

    await window.dashboardAPI.setDailyIntentions(date, updated);

    const newMap = new Map(get().intentions);
    newMap.set(date, updated);
    set({ intentions: newMap });
  },

  getIntentions: (date: string) => {
    return get().intentions.get(date) || [];
  }
}));

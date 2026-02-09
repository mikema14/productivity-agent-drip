import { create } from 'zustand';
import type { ShutdownRitual } from '../types';

interface ShutdownStore {
  rituals: Map<string, ShutdownRitual>;
  isLoading: boolean;

  // Actions
  loadRitual: (date: string) => Promise<void>;
  saveRitual: (
    date: string,
    totalMinutes: number,
    deepWorkMinutes: number,
    tasksWorked: string[],
    reflection: string | null,
    notes: string | null,
    tomorrowIntentions: string[] | null
  ) => Promise<void>;
  unlockDay: (date: string) => Promise<void>;
  isDayLocked: (date: string) => Promise<boolean>;
  getRitual: (date: string) => ShutdownRitual | null;
}

export const useShutdownStore = create<ShutdownStore>((set, get) => ({
  rituals: new Map(),
  isLoading: false,

  loadRitual: async (date: string) => {
    if (!window.dashboardAPI) return;

    set({ isLoading: true });
    try {
      const ritual = await window.dashboardAPI.getShutdownRitual(date);
      if (ritual) {
        const newRituals = new Map(get().rituals);
        newRituals.set(date, ritual);
        set({ rituals: newRituals });
      }
    } catch (error) {
      console.error('Failed to load shutdown ritual:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  saveRitual: async (
    date: string,
    totalMinutes: number,
    deepWorkMinutes: number,
    tasksWorked: string[],
    reflection: string | null,
    notes: string | null,
    tomorrowIntentions: string[] | null
  ) => {
    if (!window.dashboardAPI) return;

    try {
      await window.dashboardAPI.saveShutdownRitual(
        date,
        totalMinutes,
        deepWorkMinutes,
        tasksWorked,
        reflection,
        notes,
        tomorrowIntentions
      );

      // Create the ritual object to store locally
      const ritual: ShutdownRitual = {
        date,
        totalMinutes,
        deepWorkMinutes,
        tasksWorked,
        reflection,
        notes,
        tomorrowIntentions,
        locked: true,
        createdAt: new Date().toISOString()
      };

      const newRituals = new Map(get().rituals);
      newRituals.set(date, ritual);
      set({ rituals: newRituals });
    } catch (error) {
      console.error('Failed to save shutdown ritual:', error);
      throw error;
    }
  },

  unlockDay: async (date: string) => {
    if (!window.dashboardAPI) return;

    try {
      await window.dashboardAPI.unlockDay(date);

      // Update local state
      const ritual = get().rituals.get(date);
      if (ritual) {
        const newRituals = new Map(get().rituals);
        newRituals.set(date, { ...ritual, locked: false });
        set({ rituals: newRituals });
      }
    } catch (error) {
      console.error('Failed to unlock day:', error);
      throw error;
    }
  },

  isDayLocked: async (date: string) => {
    if (!window.dashboardAPI) return false;

    try {
      return await window.dashboardAPI.isDayLocked(date);
    } catch (error) {
      console.error('Failed to check if day is locked:', error);
      return false;
    }
  },

  getRitual: (date: string) => {
    return get().rituals.get(date) || null;
  }
}));

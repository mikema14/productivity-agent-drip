import { create } from 'zustand';
import type { TaskPreference } from '../types';

interface TaskPreferencesState {
  preferences: Map<string, TaskPreference>;
  isLoading: boolean;

  // Actions
  loadAll: () => Promise<void>;
  getPreference: (taskId: string) => TaskPreference | undefined;
  setTracked: (taskId: string, tracked: boolean) => Promise<void>;
  togglePinned: (taskId: string) => Promise<void>;
  attachMilestone: (taskId: string, milestoneId: string) => Promise<void>;
  detachMilestone: (taskId: string, milestoneId: string) => Promise<void>;
}

export const useTaskPreferencesStore = create<TaskPreferencesState>((set, get) => ({
  preferences: new Map(),
  isLoading: false,

  loadAll: async () => {
    set({ isLoading: true });
    try {
      const prefs = await window.dashboardAPI.getAllTaskPreferences();
      const prefMap = new Map(prefs.map(p => [p.taskId, p]));
      set({ preferences: prefMap });
    } finally {
      set({ isLoading: false });
    }
  },

  getPreference: (taskId: string) => {
    return get().preferences.get(taskId);
  },

  setTracked: async (taskId: string, tracked: boolean) => {
    const existing = get().getPreference(taskId);
    const updated = { ...existing, taskId, tracked, pinned: existing?.pinned || false, milestoneIds: existing?.milestoneIds || [] };

    await window.dashboardAPI.setTaskPreference(taskId, updated);

    const newMap = new Map(get().preferences);
    newMap.set(taskId, updated);
    set({ preferences: newMap });
  },

  togglePinned: async (taskId: string) => {
    const existing = get().getPreference(taskId);
    const updated = { ...existing, taskId, pinned: !existing?.pinned, tracked: existing?.tracked || false, milestoneIds: existing?.milestoneIds || [] };

    await window.dashboardAPI.setTaskPreference(taskId, updated);

    const newMap = new Map(get().preferences);
    newMap.set(taskId, updated);
    set({ preferences: newMap });
  },

  attachMilestone: async (taskId: string, milestoneId: string) => {
    const existing = get().getPreference(taskId);
    const milestoneIds = [...(existing?.milestoneIds || []), milestoneId];
    const updated = { ...existing, taskId, milestoneIds, tracked: existing?.tracked || false, pinned: existing?.pinned || false };

    await window.dashboardAPI.setTaskPreference(taskId, updated);

    const newMap = new Map(get().preferences);
    newMap.set(taskId, updated);
    set({ preferences: newMap });
  },

  detachMilestone: async (taskId: string, milestoneId: string) => {
    const existing = get().getPreference(taskId);
    const milestoneIds = (existing?.milestoneIds || []).filter(id => id !== milestoneId);
    const updated = { ...existing, taskId, milestoneIds, tracked: existing?.tracked || false, pinned: existing?.pinned || false };

    await window.dashboardAPI.setTaskPreference(taskId, updated);

    const newMap = new Map(get().preferences);
    newMap.set(taskId, updated);
    set({ preferences: newMap });
  }
}));

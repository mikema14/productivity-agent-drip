import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Milestone } from '../types';

interface MilestonesState {
  milestones: Map<string, Milestone>;
  isLoading: boolean;

  // Actions
  loadByParent: (parentType: string, parentId: string) => Promise<void>;
  createMilestone: (parentType: string, parentId: string, title: string, description?: string) => Promise<Milestone>;
  updateMilestone: (id: string, patch: Partial<Milestone>) => Promise<void>;
  deleteMilestone: (id: string) => Promise<void>;
  toggleCompleted: (id: string) => Promise<void>;
  getMilestone: (id: string) => Milestone | undefined;
  getMilestonesByParent: (parentType: string, parentId: string) => Milestone[];
}

export const useMilestonesStore = create<MilestonesState>((set, get) => ({
  milestones: new Map(),
  isLoading: false,

  loadByParent: async (parentType: string, parentId: string) => {
    set({ isLoading: true });
    try {
      const milestones = await window.dashboardAPI.getMilestonesByParent(parentType, parentId);
      const milestoneMap = new Map(get().milestones);
      milestones.forEach(m => milestoneMap.set(m.id, m));
      set({ milestones: milestoneMap });
    } finally {
      set({ isLoading: false });
    }
  },

  createMilestone: async (parentType: string, parentId: string, title: string, description?: string) => {
    const existingMilestones = get().getMilestonesByParent(parentType, parentId);
    const nextOrder = existingMilestones.length;

    const milestone: Milestone = {
      id: uuidv4(),
      parentType: parentType as 'task' | 'goal',
      parentId,
      title,
      description,
      completed: false,
      order: nextOrder,
      weight: undefined
    };

    await window.dashboardAPI.createMilestone(milestone);

    const newMap = new Map(get().milestones);
    newMap.set(milestone.id, milestone);
    set({ milestones: newMap });

    return milestone;
  },

  updateMilestone: async (id: string, patch: Partial<Milestone>) => {
    await window.dashboardAPI.updateMilestone(id, patch);

    const milestone = get().milestones.get(id);
    if (milestone) {
      const updated = { ...milestone, ...patch };
      const newMap = new Map(get().milestones);
      newMap.set(id, updated);
      set({ milestones: newMap });
    }
  },

  deleteMilestone: async (id: string) => {
    await window.dashboardAPI.deleteMilestone(id);

    const newMap = new Map(get().milestones);
    newMap.delete(id);
    set({ milestones: newMap });
  },

  toggleCompleted: async (id: string) => {
    const milestone = get().milestones.get(id);
    if (milestone) {
      await get().updateMilestone(id, { completed: !milestone.completed });
    }
  },

  getMilestone: (id: string) => {
    return get().milestones.get(id);
  },

  getMilestonesByParent: (parentType: string, parentId: string) => {
    return Array.from(get().milestones.values())
      .filter(m => m.parentType === parentType && m.parentId === parentId)
      .sort((a, b) => a.order - b.order);
  }
}));

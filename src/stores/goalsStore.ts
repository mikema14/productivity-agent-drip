import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Goal } from '../types';

interface GoalsState {
  goals: Map<string, Goal>;
  activeGoalId: string | null;
  isLoading: boolean;

  // Actions
  loadAll: () => Promise<void>;
  createGoal: (title: string, description: string, identityReinforcement?: string) => Promise<Goal>;
  updateGoal: (id: string, patch: Partial<Goal>) => Promise<void>;
  setActiveGoal: (id: string) => Promise<void>;
  getGoal: (id: string) => Goal | undefined;
  getActiveGoal: () => Goal | undefined;
  getAllGoals: () => Goal[];
}

export const useGoalsStore = create<GoalsState>((set, get) => ({
  goals: new Map(),
  activeGoalId: null,
  isLoading: false,

  loadAll: async () => {
    set({ isLoading: true });
    try {
      const goals = await window.dashboardAPI.getAllGoals();
      const goalMap = new Map(goals.map(g => [g.id, g]));
      const active = goals.find(g => g.active);
      set({ goals: goalMap, activeGoalId: active?.id || null });
    } finally {
      set({ isLoading: false });
    }
  },

  createGoal: async (title: string, description: string, identityReinforcement?: string) => {
    const goal: Goal = {
      id: uuidv4(),
      title,
      description,
      identityReinforcement,
      milestoneIds: [],
      active: false
    };

    await window.dashboardAPI.createGoal(goal);

    const newMap = new Map(get().goals);
    newMap.set(goal.id, goal);
    set({ goals: newMap });

    return goal;
  },

  updateGoal: async (id: string, patch: Partial<Goal>) => {
    await window.dashboardAPI.updateGoal(id, patch);

    const goal = get().goals.get(id);
    if (goal) {
      const updated = { ...goal, ...patch };
      const newMap = new Map(get().goals);
      newMap.set(id, updated);
      set({ goals: newMap });
    }
  },

  setActiveGoal: async (id: string) => {
    await window.dashboardAPI.setActiveGoal(id);

    // Update all goals in state
    const newMap = new Map(get().goals);
    newMap.forEach((goal, goalId) => {
      newMap.set(goalId, { ...goal, active: goalId === id });
    });

    set({ goals: newMap, activeGoalId: id });
  },

  getGoal: (id: string) => {
    return get().goals.get(id);
  },

  getActiveGoal: () => {
    const { activeGoalId, goals } = get();
    return activeGoalId ? goals.get(activeGoalId) : undefined;
  },

  getAllGoals: () => {
    return Array.from(get().goals.values());
  }
}));

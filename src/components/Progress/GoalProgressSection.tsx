import { useState, useEffect } from 'react';
import { useGoalsStore } from '../../stores/goalsStore';
import type { Goal } from '../../types';

interface GoalWithProgress extends Goal {
  accumulatedMinutes: number;
  linkedTasks: Array<{ taskId: string; title: string; minutes: number }>;
}

export default function GoalProgressSection() {
  const { getAllGoals, loadAll } = useGoalsStore();
  const goals = getAllGoals();
  const [goalsWithProgress, setGoalsWithProgress] = useState<GoalWithProgress[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadGoalProgress();
  }, [goals]);

  async function loadGoalProgress() {
    const result: GoalWithProgress[] = [];

    for (const goal of goals) {
      const allPrefs = await window.dashboardAPI.getAllTaskPreferences();
      const linkedPrefs = allPrefs.filter((p: any) => p.goalId === goal.id);

      const linkedTasks: Array<{ taskId: string; title: string; minutes: number }> = [];
      let totalMinutes = 0;

      for (const pref of linkedPrefs) {
        const minutes = await window.dashboardAPI.getTaskTotalMinutes(pref.taskId);
        const cached = await window.logAPI.getCachedTask(pref.taskId);
        linkedTasks.push({
          taskId: pref.taskId,
          title: cached?.title || `#${pref.taskId}`,
          minutes
        });
        totalMinutes += minutes;
      }

      result.push({ ...goal, accumulatedMinutes: totalMinutes, linkedTasks });
    }

    setGoalsWithProgress(result);
  }

  if (goalsWithProgress.length === 0) {
    return (
      <div className="glass-surface p-6 h-full flex flex-col items-center justify-center text-center">
        <div className="text-txt-dim/20 text-3xl font-mono mb-2">+</div>
        <p className="text-xs text-txt-dim">No goals defined</p>
        <p className="text-[10px] text-txt-dim/60 mt-1">Create goals in Settings</p>
      </div>
    );
  }

  return (
    <div className="glass-surface p-6 h-full">
      <h2 className="text-xs uppercase tracking-[0.15em] text-txt-muted font-display mb-5">Goals</h2>

      <div className="space-y-5">
        {goalsWithProgress.map(goal => {
          const accHours = Math.round(goal.accumulatedMinutes / 60 * 10) / 10;
          const target = goal.targetHours;
          const pct = target ? Math.min((goal.accumulatedMinutes / (target * 60)) * 100, 100) : null;

          return (
            <div key={goal.id}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm font-display font-medium text-txt-primary truncate mr-3">
                  {goal.title}
                </span>
                <span className="text-xs font-mono text-txt-secondary whitespace-nowrap">
                  {accHours}h
                  {target ? <span className="text-txt-dim"> / {target}h</span> : null}
                  {pct !== null && <span className="text-focus ml-1.5">{Math.round(pct)}%</span>}
                </span>
              </div>

              <div className="h-1.5 bg-white/[0.04] rounded-full overflow-visible relative">
                <div
                  className="goal-bar-fill h-full bg-gradient-to-r from-focus/60 to-focus rounded-full transition-all duration-700 ease-out"
                  style={{ width: pct !== null ? `${Math.max(pct, 2)}%` : '100%', opacity: pct !== null ? 1 : 0.2 }}
                />
              </div>

              {goal.linkedTasks.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {goal.linkedTasks.map(task => (
                    <span
                      key={task.taskId}
                      className="px-2 py-0.5 bg-white/[0.03] border border-glass-border text-txt-dim rounded text-[10px] font-mono hover:text-txt-muted transition-colors"
                      title={`${task.title}: ${Math.round(task.minutes / 60 * 10) / 10}h`}
                    >
                      #{task.taskId}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-txt-dim mt-2 italic">Link tasks in Settings</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

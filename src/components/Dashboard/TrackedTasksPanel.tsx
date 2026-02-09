import { useState, useEffect } from 'react';
import { useTaskPreferencesStore } from '../../stores/taskPreferencesStore';
import { useMilestonesStore } from '../../stores/milestonesStore';
import { useLogStore } from '../../stores/logStore';
import type { Milestone } from '../../types';

interface TaskData {
  taskId: string;
  title: string;
  projectName: string | null;
  progress: number;
  milestones: Milestone[];
  timeSpent: string;
}

interface TrackedTasksPanelProps {
  onNavigateToTask?: (taskId: string) => void;
}

export default function TrackedTasksPanel({ onNavigateToTask }: TrackedTasksPanelProps) {
  const { preferences } = useTaskPreferencesStore();
  const { getMilestonesByParent, toggleCompleted } = useMilestonesStore();
  const logStore = useLogStore();
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, [preferences]);

  const loadTasks = async () => {
    setIsLoading(true);

    // Filter tracked tasks
    const trackedPrefs = Array.from(preferences.values()).filter(p => p.tracked);

    // Sort: pinned first, then by taskId
    trackedPrefs.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return a.taskId.localeCompare(b.taskId);
    });

    const taskDataPromises = trackedPrefs.map(async (pref) => {
      // Get task metadata
      const cached = await window.logAPI.getCachedTask(pref.taskId);
      const title = cached?.title || `Task ${pref.taskId}`;
      const projectName = cached?.project_name || null;

      // Get milestones
      const milestones = getMilestonesByParent('task', pref.taskId);
      const completedCount = milestones.filter(m => m.completed).length;
      const totalCount = milestones.length;

      // Calculate progress
      let progress = 0;
      if (totalCount > 0) {
        progress = Math.round((completedCount / totalCount) * 100);
      } else {
        // Fallback: estimate based on time (assume 10 hours = 100%)
        const taskProgress = (logStore as any).getTaskProgress?.(pref.taskId) || { totalMinutes: 0 };
        const totalMinutes = taskProgress.totalMinutes || 0;
        const estimatedHours = 10;
        progress = Math.min(Math.round((totalMinutes / (estimatedHours * 60)) * 100), 100);
      }

      // Format time spent
      const taskProgress = (logStore as any).getTaskProgress?.(pref.taskId) || { totalMinutes: 0 };
      const totalMinutes = taskProgress.totalMinutes || 0;
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      const timeSpent = `${hours}h ${mins}m`;

      return {
        taskId: pref.taskId,
        title,
        projectName,
        progress,
        milestones,
        timeSpent
      };
    });

    const taskData = await Promise.all(taskDataPromises);
    setTasks(taskData);
    setIsLoading(false);
  };

  const toggleExpanded = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const handleToggleMilestone = async (milestoneId: string) => {
    await toggleCompleted(milestoneId);
    await loadTasks(); // Reload to update progress
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="text-gray-500">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Your Key Tasks</h2>

      {tasks.length === 0 ? (
        <p className="text-gray-400 text-sm">
          No tracked tasks. Mark tasks as tracked in Settings to see them here.
        </p>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isExpanded = expandedTasks.has(task.taskId);

            return (
              <div key={task.taskId} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                {/* Line 1: Project Name / Title + Task ID */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{task.title}</h3>
                    {task.projectName && (
                      <p className="text-xs text-gray-500 mt-0.5">{task.projectName}</p>
                    )}
                  </div>
                  <span className="ml-3 text-sm font-mono text-gray-600 flex-shrink-0">
                    ID: {task.taskId}
                  </span>
                </div>

                {/* Line 2: Solid Progress Bar */}
                <div className="mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-10 text-right">
                      {task.progress}%
                    </span>
                  </div>
                </div>

                {/* Line 3: Time Spent + View Details */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    <span className="font-medium">{task.timeSpent}</span> spent
                  </span>
                  <div className="flex items-center gap-3">
                    {task.milestones.length > 0 && (
                      <button
                        onClick={() => toggleExpanded(task.taskId)}
                        className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                      >
                        {isExpanded ? '▼' : '▶'} Milestones ({task.milestones.filter(m => m.completed).length}/{task.milestones.length})
                      </button>
                    )}
                    {onNavigateToTask && (
                      <button
                        onClick={() => onNavigateToTask(task.taskId)}
                        className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                      >
                        View Details →
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible Milestones Section */}
                {isExpanded && task.milestones.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="space-y-1.5">
                      {task.milestones.map((milestone) => (
                        <div key={milestone.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={milestone.completed}
                            onChange={() => handleToggleMilestone(milestone.id)}
                            className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded"
                          />
                          <span className={milestone.completed ? 'line-through text-gray-400' : 'text-gray-700'}>
                            {milestone.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useMilestonesStore } from '../../stores/milestonesStore';
import { useLogStore } from '../../stores/logStore';
import type { Milestone } from '../../types';

interface TaskDetailsPageProps {
  taskId: string;
}

interface TaskCache {
  task_id: string;
  title: string;
  project_id: number;
  project_name: string | null;
}

export default function TaskDetailsPage({ taskId }: TaskDetailsPageProps) {
  const { getMilestonesByParent, createMilestone, toggleCompleted, deleteMilestone, loadByParent } = useMilestonesStore();
  const logStore = useLogStore();

  const [task, setTask] = useState<TaskCache | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');

  useEffect(() => {
    loadTaskData();
  }, [taskId]);

  const loadTaskData = async () => {
    // Load milestones from store
    await loadByParent('task', taskId);

    const cached = await window.logAPI.getCachedTask(taskId);
    setTask(cached);

    const taskMilestones = getMilestonesByParent('task', taskId);
    setMilestones(taskMilestones);
  };

  const handleAddMilestone = async () => {
    if (!newMilestoneTitle.trim()) return;

    await createMilestone('task', taskId, newMilestoneTitle.trim());
    setNewMilestoneTitle('');
    setIsAddingMilestone(false);
    loadTaskData(); // Refresh milestones
  };

  const handleToggleComplete = async (milestoneId: string) => {
    await toggleCompleted(milestoneId);
    loadTaskData();
  };

  const handleDelete = async (milestoneId: string) => {
    if (!confirm('Delete this milestone?')) return;
    await deleteMilestone(milestoneId);
    loadTaskData();
  };

  const taskProgress = (logStore as any).getTaskProgress?.(taskId) || { totalMinutes: 0, sessionCount: 0 };
  const totalMinutes = taskProgress.totalMinutes || 0;
  const sessionCount = taskProgress.sessionCount || 0;

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  const completedCount = milestones.filter(m => m.completed).length;
  const progress = milestones.length > 0
    ? Math.round((completedCount / milestones.length) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="glass-surface p-6">
        <h1 className="text-2xl font-display font-semibold text-txt-primary mb-4">{taskId}</h1>
        {task && <p className="text-txt-secondary mb-4">{task.title}</p>}

        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-txt-muted">Time spent:</span>
            <span className="ml-2 font-semibold text-txt-primary">{hours}h {mins}m</span>
          </div>
          <div>
            <span className="text-txt-muted">Sessions:</span>
            <span className="ml-2 font-semibold text-txt-primary">{sessionCount}</span>
          </div>
          <div>
            <span className="text-txt-muted">Progress:</span>
            <span className="ml-2 font-semibold text-focus">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Milestones */}
      <div className="glass-surface p-6">
        <h2 className="text-lg font-display font-semibold text-txt-primary mb-4">
          Milestones ({completedCount}/{milestones.length})
        </h2>

        <div className="space-y-2 mb-4">
          {milestones.map((milestone) => (
            <div key={milestone.id} className="flex items-center gap-2 p-2 hover:bg-glass-hover rounded-xl">
              <input
                type="checkbox"
                checked={milestone.completed}
                onChange={() => handleToggleComplete(milestone.id)}
                className="w-4 h-4 text-focus border-glass-border bg-glass-bg rounded"
              />
              <span className={`flex-1 ${milestone.completed ? 'line-through text-txt-dim' : 'text-txt-primary'}`}>
                {milestone.title}
              </span>
              <button
                onClick={() => handleDelete(milestone.id)}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                Delete
              </button>
            </div>
          ))}

          {milestones.length === 0 && !isAddingMilestone && (
            <p className="text-txt-muted text-sm">No milestones yet</p>
          )}
        </div>

        {/* Add Milestone */}
        {!isAddingMilestone ? (
          <button
            onClick={() => setIsAddingMilestone(true)}
            className="text-sm text-focus hover:text-focus-light"
          >
            + Add Milestone
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={newMilestoneTitle}
              onChange={(e) => setNewMilestoneTitle(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddMilestone()}
              placeholder="Milestone title"
              className="flex-1 px-4 py-2.5 bg-glass-bg border border-glass-border rounded-xl text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
              autoFocus
            />
            <button
              onClick={handleAddMilestone}
              className="px-3 py-2 text-sm font-display font-medium text-drip-bg bg-focus hover:bg-focus-light rounded-xl"
            >
              Add
            </button>
            <button
              onClick={() => setIsAddingMilestone(false)}
              className="px-3 py-2 text-sm text-txt-muted hover:bg-glass-hover rounded-xl"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

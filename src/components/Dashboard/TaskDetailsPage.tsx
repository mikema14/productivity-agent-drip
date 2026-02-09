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
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{taskId}</h1>
        {task && <p className="text-gray-600 mb-4">{task.title}</p>}

        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-gray-500">Time spent:</span>
            <span className="ml-2 font-semibold text-gray-900">{hours}h {mins}m</span>
          </div>
          <div>
            <span className="text-gray-500">Sessions:</span>
            <span className="ml-2 font-semibold text-gray-900">{sessionCount}</span>
          </div>
          <div>
            <span className="text-gray-500">Progress:</span>
            <span className="ml-2 font-semibold text-blue-600">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Milestones */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Milestones ({completedCount}/{milestones.length})
        </h2>

        <div className="space-y-2 mb-4">
          {milestones.map((milestone) => (
            <div key={milestone.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
              <input
                type="checkbox"
                checked={milestone.completed}
                onChange={() => handleToggleComplete(milestone.id)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className={`flex-1 ${milestone.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                {milestone.title}
              </span>
              <button
                onClick={() => handleDelete(milestone.id)}
                className="text-red-600 hover:text-red-700 text-sm"
              >
                Delete
              </button>
            </div>
          ))}

          {milestones.length === 0 && !isAddingMilestone && (
            <p className="text-gray-400 text-sm">No milestones yet</p>
          )}
        </div>

        {/* Add Milestone */}
        {!isAddingMilestone ? (
          <button
            onClick={() => setIsAddingMilestone(true)}
            className="text-sm text-blue-600 hover:text-blue-700"
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
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={handleAddMilestone}
              className="px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded"
            >
              Add
            </button>
            <button
              onClick={() => setIsAddingMilestone(false)}
              className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

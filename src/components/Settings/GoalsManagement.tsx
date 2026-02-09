import { useState, useEffect } from 'react';
import { useGoalsStore } from '../../stores/goalsStore';
import type { Goal } from '../../types';

export default function GoalsManagement() {
  const {
    getAllGoals,
    getActiveGoal,
    createGoal,
    updateGoal,
    setActiveGoal,
    loadAll
  } = useGoalsStore();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [activeGoal, setActiveGoalLocal] = useState<Goal | undefined>();

  // Create form state
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIdentity, setNewIdentity] = useState('');

  // Edit form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIdentity, setEditIdentity] = useState('');

  const [message, setMessage] = useState('');

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    await loadAll();
    setGoals(getAllGoals());
    setActiveGoalLocal(getActiveGoal());
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      showMessage('Title is required');
      return;
    }

    try {
      await createGoal(newTitle.trim(), newDescription.trim(), newIdentity.trim() || undefined);
      setNewTitle('');
      setNewDescription('');
      setNewIdentity('');
      setIsCreating(false);
      await loadGoals();
      showMessage('Goal created successfully');
    } catch (error) {
      showMessage('Failed to create goal');
    }
  };

  const handleSetActive = async (goalId: string) => {
    try {
      await setActiveGoal(goalId);
      await loadGoals();
      showMessage('Active goal updated');
    } catch (error) {
      showMessage('Failed to set active goal');
    }
  };

  const handleStartEdit = (goal: Goal) => {
    setEditingId(goal.id);
    setEditTitle(goal.title);
    setEditDescription(goal.description);
    setEditIdentity(goal.identityReinforcement || '');
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    try {
      await updateGoal(editingId, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        identityReinforcement: editIdentity.trim() || undefined
      });
      setEditingId(null);
      await loadGoals();
      showMessage('Goal updated successfully');
    } catch (error) {
      showMessage('Failed to update goal');
    }
  };

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Message Display */}
      {message && (
        <div className="p-3 bg-blue-50 text-blue-800 rounded border border-blue-200 text-sm">
          {message}
        </div>
      )}

      {/* Active Goal Display */}
      {activeGoal && (
        <div className="p-4 bg-green-50 border border-green-200 rounded">
          <div className="text-sm font-medium text-green-800 mb-1">Active Goal</div>
          <div className="text-lg font-bold text-green-900">{activeGoal.title}</div>
          {activeGoal.identityReinforcement && (
            <div className="text-sm text-green-700 mt-1">
              I am becoming: {activeGoal.identityReinforcement}
            </div>
          )}
        </div>
      )}

      {/* Goals List */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Your Goals</h3>

        {goals.length === 0 ? (
          <p className="text-gray-500 text-sm">No goals created yet</p>
        ) : (
          goals.map(goal => (
            <div key={goal.id} className="border border-gray-200 rounded p-4">
              {editingId === goal.id ? (
                // Edit Mode
                <div className="space-y-3">
                  <input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    placeholder="Goal title"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    placeholder="Description"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    value={editIdentity}
                    onChange={e => setEditIdentity(e.target.value)}
                    placeholder="Identity reinforcement (e.g., 'a focused developer')"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // Display Mode
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{goal.title}</h4>
                      {goal.description && (
                        <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                      )}
                      {goal.identityReinforcement && (
                        <p className="text-sm text-blue-600 mt-1">
                          I am becoming: {goal.identityReinforcement}
                        </p>
                      )}
                    </div>
                    {goal.active && (
                      <span className="ml-2 px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 mt-3">
                    {!goal.active && (
                      <button
                        onClick={() => handleSetActive(goal.id)}
                        className="px-3 py-1 text-sm text-white bg-green-600 hover:bg-green-700 rounded"
                      >
                        Set Active
                      </button>
                    )}
                    <button
                      onClick={() => handleStartEdit(goal)}
                      className="px-3 py-1 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create New Goal */}
      <div className="border-t pt-4">
        {!isCreating ? (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded"
          >
            + Create New Goal
          </button>
        ) : (
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Create New Goal</h3>

            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Goal title (required)"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />

            <textarea
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />

            <input
              value={newIdentity}
              onChange={e => setNewIdentity(e.target.value)}
              placeholder="Identity reinforcement (e.g., 'a focused developer')"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
              >
                Create Goal
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
        <div className="p-3 bg-focus/10 text-focus rounded-xl border border-focus/20 text-sm">
          {message}
        </div>
      )}

      {/* Active Goal Display */}
      {activeGoal && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <div className="text-sm font-medium text-emerald-400 mb-1">Active Goal</div>
          <div className="text-lg font-display font-semibold text-emerald-300">{activeGoal.title}</div>
          {activeGoal.identityReinforcement && (
            <div className="text-sm text-emerald-400 mt-1">
              I am becoming: {activeGoal.identityReinforcement}
            </div>
          )}
        </div>
      )}

      {/* Goals List */}
      <div className="space-y-3">
        <h3 className="font-display font-semibold text-txt-primary">Your Goals</h3>

        {goals.length === 0 ? (
          <p className="text-txt-muted text-sm">No goals created yet</p>
        ) : (
          goals.map(goal => (
            <div key={goal.id} className="border border-focus/20 rounded-xl p-4">
              {editingId === goal.id ? (
                // Edit Mode
                <div className="space-y-3">
                  <input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    placeholder="Goal title"
                    className="w-full px-4 py-2.5 bg-transparent border border-focus/20 rounded-xl text-txt-primary placeholder-txt-dim focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
                  />
                  <textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    placeholder="Description"
                    rows={2}
                    className="w-full px-4 py-2.5 bg-transparent border border-focus/20 rounded-xl text-txt-primary placeholder-txt-dim focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
                  />
                  <input
                    value={editIdentity}
                    onChange={e => setEditIdentity(e.target.value)}
                    placeholder="Identity reinforcement (e.g., 'a focused developer')"
                    className="w-full px-4 py-2.5 bg-transparent border border-focus/20 rounded-xl text-txt-primary placeholder-txt-dim focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-2 text-sm font-display font-medium text-drip-bg bg-focus hover:bg-focus-light rounded-xl"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 text-sm text-txt-muted hover:bg-focus/5 rounded-xl"
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
                      <h4 className="font-semibold text-txt-primary">{goal.title}</h4>
                      {goal.description && (
                        <p className="text-sm text-txt-secondary mt-1">{goal.description}</p>
                      )}
                      {goal.identityReinforcement && (
                        <p className="text-sm text-focus mt-1">
                          I am becoming: {goal.identityReinforcement}
                        </p>
                      )}
                    </div>
                    {goal.active && (
                      <span className="ml-2 px-2 py-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 mt-3">
                    {!goal.active && (
                      <button
                        onClick={() => handleSetActive(goal.id)}
                        className="px-3 py-1 text-sm text-white bg-emerald-500/80 hover:bg-emerald-500 rounded-xl"
                      >
                        Set Active
                      </button>
                    )}
                    <button
                      onClick={() => handleStartEdit(goal)}
                      className="px-3 py-1 text-sm bg-focus/10 text-focus hover:bg-focus/20 rounded-xl"
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
      <div className="border-t border-focus/20 pt-4">
        {!isCreating ? (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 text-sm bg-focus/10 text-focus hover:bg-focus/20 rounded-xl"
          >
            + Create New Goal
          </button>
        ) : (
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-txt-primary">Create New Goal</h3>

            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Goal title (required)"
              className="w-full px-4 py-2.5 bg-transparent border border-focus/20 rounded-xl text-txt-primary placeholder-txt-dim focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
            />

            <textarea
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full px-4 py-2.5 bg-transparent border border-focus/20 rounded-xl text-txt-primary placeholder-txt-dim focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
            />

            <input
              value={newIdentity}
              onChange={e => setNewIdentity(e.target.value)}
              placeholder="Identity reinforcement (e.g., 'a focused developer')"
              className="w-full px-4 py-2.5 bg-transparent border border-focus/20 rounded-xl text-txt-primary placeholder-txt-dim focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
            />

            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="px-6 py-2 text-sm font-display font-medium text-drip-bg bg-focus hover:bg-focus-light rounded-xl"
              >
                Create Goal
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-sm text-txt-muted hover:bg-focus/5 rounded-xl"
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

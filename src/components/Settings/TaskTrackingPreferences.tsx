import { useState, useEffect } from 'react';
import { useTaskPreferencesStore } from '../../stores/taskPreferencesStore';

export default function TaskTrackingPreferences() {
  const {
    preferences,
    loadAll,
    setTracked,
    togglePinned
  } = useTaskPreferencesStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [newTaskId, setNewTaskId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  const handleAddTask = async () => {
    if (!newTaskId.trim()) {
      showMessage('Task ID is required');
      return;
    }

    try {
      await setTracked(newTaskId.trim(), true);
      setNewTaskId('');
      showMessage(`Task ${newTaskId} is now tracked`);
    } catch (error) {
      showMessage('Failed to add task');
    }
  };

  const handleToggleTracked = async (taskId: string, currentValue: boolean) => {
    try {
      await setTracked(taskId, !currentValue);
      showMessage(`Task ${taskId} ${!currentValue ? 'tracked' : 'untracked'}`);
    } catch (error) {
      showMessage('Failed to update task');
    }
  };

  const handleTogglePinned = async (taskId: string) => {
    try {
      await togglePinned(taskId);
      showMessage(`Task ${taskId} pin toggled`);
    } catch (error) {
      showMessage('Failed to toggle pin');
    }
  };

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const filteredTasks = Array.from(preferences.values()).filter(t =>
    t.taskId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Message Display */}
      {message && (
        <div className="p-3 bg-focus/10 text-focus rounded-xl border border-focus/20 text-sm">
          {message}
        </div>
      )}

      {/* Add New Task */}
      <div>
        <label className="block uppercase tracking-wider text-xs text-txt-muted mb-2">
          Track New Task
        </label>
        <div className="flex gap-2">
          <input
            value={newTaskId}
            onChange={e => setNewTaskId(e.target.value)}
            placeholder="Enter task ID (e.g., TASK-123)"
            className="flex-1 px-4 py-2.5 bg-glass-bg border border-glass-border rounded-xl text-txt-primary placeholder-txt-dim focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
            onKeyPress={e => e.key === 'Enter' && handleAddTask()}
          />
          <button
            onClick={handleAddTask}
            className="px-6 py-2 text-sm font-display font-medium text-drip-bg bg-focus hover:bg-focus-light rounded-xl"
          >
            Add Task
          </button>
        </div>
        <p className="text-xs text-txt-dim mt-1">
          Tracked tasks appear in the Dashboard
        </p>
      </div>

      {/* Search */}
      {preferences.size > 0 && (
        <div>
          <label className="block uppercase tracking-wider text-xs text-txt-muted mb-2">
            Search Tasks
          </label>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter by task ID..."
            className="w-full px-4 py-2.5 bg-glass-bg border border-glass-border rounded-xl text-txt-primary placeholder-txt-dim focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
          />
        </div>
      )}

      {/* Task List */}
      <div>
        <h3 className="text-sm font-medium text-txt-muted mb-2">
          Tracked Tasks ({filteredTasks.filter(t => t.tracked).length})
        </h3>

        {filteredTasks.length === 0 ? (
          <p className="text-txt-muted text-sm">
            {searchQuery ? 'No tasks match your search' : 'No tracked tasks yet'}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map(pref => (
              <div
                key={pref.taskId}
                className="flex items-center justify-between p-3 border border-glass-border rounded-xl hover:bg-glass-hover"
              >
                <div className="flex items-center gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={pref.tracked}
                    onChange={() => handleToggleTracked(pref.taskId, pref.tracked)}
                    className="w-4 h-4 text-focus border-glass-border bg-glass-bg rounded"
                  />
                  <span className="font-mono text-sm font-semibold text-txt-primary">
                    {pref.taskId}
                  </span>
                  {pref.pinned && (
                    <span className="px-2 py-1 text-xs font-medium text-focus bg-focus/10 border border-focus/20 rounded">
                      Pinned
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTogglePinned(pref.taskId)}
                    className={`px-3 py-1 text-sm rounded-xl ${
                      pref.pinned
                        ? 'text-focus bg-focus/10 hover:bg-focus/20'
                        : 'text-txt-muted bg-glass-bg hover:bg-glass-hover'
                    }`}
                  >
                    {pref.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    onClick={() => handleToggleTracked(pref.taskId, pref.tracked)}
                    className="px-3 py-1 text-sm text-red-400 hover:bg-red-500/10 rounded-xl"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useTaskPreferencesStore } from '../../stores/taskPreferencesStore';
import type { TaskPreference } from '../../types';

export default function TaskTrackingPreferences() {
  const {
    preferences,
    loadAll,
    setTracked,
    togglePinned
  } = useTaskPreferencesStore();

  const [taskList, setTaskList] = useState<TaskPreference[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTaskId, setNewTaskId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    await loadAll();
    setTaskList(Array.from(preferences.values()));
  };

  const handleAddTask = async () => {
    if (!newTaskId.trim()) {
      showMessage('Task ID is required');
      return;
    }

    try {
      await setTracked(newTaskId.trim(), true);
      setNewTaskId('');
      await loadPreferences();
      showMessage(`Task ${newTaskId} is now tracked`);
    } catch (error) {
      showMessage('Failed to add task');
    }
  };

  const handleToggleTracked = async (taskId: string, currentValue: boolean) => {
    try {
      await setTracked(taskId, !currentValue);
      await loadPreferences();
      showMessage(`Task ${taskId} ${!currentValue ? 'tracked' : 'untracked'}`);
    } catch (error) {
      showMessage('Failed to update task');
    }
  };

  const handleTogglePinned = async (taskId: string) => {
    try {
      await togglePinned(taskId);
      await loadPreferences();
      showMessage(`Task ${taskId} pin toggled`);
    } catch (error) {
      showMessage('Failed to toggle pin');
    }
  };

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const filteredTasks = taskList.filter(t =>
    t.taskId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Message Display */}
      {message && (
        <div className="p-3 bg-blue-50 text-blue-800 rounded border border-blue-200 text-sm">
          {message}
        </div>
      )}

      {/* Add New Task */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Track New Task
        </label>
        <div className="flex gap-2">
          <input
            value={newTaskId}
            onChange={e => setNewTaskId(e.target.value)}
            placeholder="Enter task ID (e.g., TASK-123)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            onKeyPress={e => e.key === 'Enter' && handleAddTask()}
          />
          <button
            onClick={handleAddTask}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
          >
            Add Task
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Tracked tasks appear in the Dashboard
        </p>
      </div>

      {/* Search */}
      {taskList.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search Tasks
          </label>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter by task ID..."
            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Task List */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Tracked Tasks ({filteredTasks.filter(t => t.tracked).length})
        </h3>

        {filteredTasks.length === 0 ? (
          <p className="text-gray-500 text-sm">
            {searchQuery ? 'No tasks match your search' : 'No tracked tasks yet'}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map(pref => (
              <div
                key={pref.taskId}
                className="flex items-center justify-between p-3 border border-gray-200 rounded hover:bg-gray-50"
              >
                <div className="flex items-center gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={pref.tracked}
                    onChange={() => handleToggleTracked(pref.taskId, pref.tracked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="font-mono text-sm font-semibold text-gray-900">
                    {pref.taskId}
                  </span>
                  {pref.pinned && (
                    <span className="px-2 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded">
                      Pinned
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTogglePinned(pref.taskId)}
                    className={`px-3 py-1 text-sm rounded ${
                      pref.pinned
                        ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                        : 'text-gray-600 bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    {pref.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    onClick={() => handleToggleTracked(pref.taskId, pref.tracked)}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
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

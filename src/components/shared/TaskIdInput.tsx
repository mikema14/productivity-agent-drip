import { useState, useEffect, useRef } from 'react';

interface TaskIdInputProps {
  value: string;
  onChange: (value: string) => void;
  onTaskSelect: (taskId: string, title: string) => void;
  placeholder?: string;
}

interface RecentTask {
  task_id: string;
  title: string;
}

export default function TaskIdInput({ value, onChange, onTaskSelect, placeholder = 'Task ID' }: TaskIdInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<RecentTask[]>([]);
  const [isSelectingFromDropdown, setIsSelectingFromDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRecentTasks();
  }, []);

  useEffect(() => {
    // Filter tasks based on input value
    if (value.trim()) {
      const searchTerm = value.toLowerCase();
      const filtered = recentTasks.filter(
        (task) =>
          task.task_id.toLowerCase().includes(searchTerm) ||
          task.title.toLowerCase().includes(searchTerm)
      );
      setFilteredTasks(filtered);
    } else {
      setFilteredTasks(recentTasks);
    }
  }, [value, recentTasks]);

  useEffect(() => {
    // Close dropdown on click outside
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadRecentTasks = async () => {
    try {
      const tasks = await window.logAPI.getRecentTasks();
      setRecentTasks(tasks);
      setFilteredTasks(tasks);
    } catch (error) {
      console.error('Failed to load recent tasks:', error);
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelectTask = (task: RecentTask) => {
    setIsSelectingFromDropdown(true);
    onChange(task.task_id);
    onTaskSelect(task.task_id, task.title);
    setIsOpen(false);
    // Reset flag after a short delay
    setTimeout(() => setIsSelectingFromDropdown(false), 100);
  };

  const handleBlur = async () => {
    // Don't process blur if we're selecting from dropdown
    if (isSelectingFromDropdown) {
      return;
    }

    setIsOpen(false);

    // If user typed a task ID that's not in dropdown, try to fetch it
    const taskId = value.trim();
    if (!taskId) return;

    // Check if it's already in recent tasks
    const existingTask = recentTasks.find(t => t.task_id === taskId);
    if (existingTask) {
      onTaskSelect(existingTask.task_id, existingTask.title);
      return;
    }

    // Try to fetch from cache first
    try {
      const cachedTask = await window.logAPI.getCachedTask(taskId);
      if (cachedTask) {
        onTaskSelect(cachedTask.task_id, cachedTask.title);
        loadRecentTasks(); // Refresh recent tasks
        return;
      }
    } catch (error) {
      console.error('Failed to fetch cached task:', error);
    }

    // Not in cache, fetch from API
    try {
      const baseUrl = await window.timerAPI.getSettings('apiBaseUrl') || 'https://es.easyproject.com';
      const apiKey = await window.timerAPI.getSettings('apiKey');

      if (!apiKey) {
        console.warn('API key not configured');
        return;
      }

      const issueData = await window.timerAPI.getIssue(baseUrl, apiKey, taskId);
      if (issueData) {
        onTaskSelect(issueData.taskId, issueData.title);
        loadRecentTasks(); // Refresh recent tasks
      }
    } catch (error) {
      console.error('Failed to fetch task from API:', error);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      {isOpen && filteredTasks.length > 0 && (
        <div className="absolute z-10 min-w-80 w-max max-w-lg mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-auto">
          {filteredTasks.map((task) => (
            <div
              key={task.task_id}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur from firing
                handleSelectTask(task);
              }}
              className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-blue-600 dark:text-blue-400 shrink-0 w-20">
                  #{task.task_id}
                </span>
                <span className="text-gray-700 dark:text-gray-300">
                  {task.title}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

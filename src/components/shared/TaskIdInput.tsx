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
    setTimeout(() => setIsSelectingFromDropdown(false), 100);
  };

  const handleBlur = async () => {
    if (isSelectingFromDropdown) {
      return;
    }

    setIsOpen(false);

    const taskId = value.trim();
    if (!taskId) return;

    const existingTask = recentTasks.find(t => t.task_id === taskId);
    if (existingTask) {
      onTaskSelect(existingTask.task_id, existingTask.title);
      return;
    }

    try {
      const cachedTask = await window.logAPI.getCachedTask(taskId);
      if (cachedTask) {
        onTaskSelect(cachedTask.task_id, cachedTask.title);
        loadRecentTasks();
        return;
      }
    } catch (error) {
      console.error('Failed to fetch cached task:', error);
    }

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
        loadRecentTasks();
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
        className="w-full px-3 py-2 bg-transparent border border-focus/30 rounded-xl
                   text-txt-primary text-sm placeholder-txt-dim
                   focus:ring-2 focus:ring-focus/30 focus:border-focus/30 transition-all"
      />

      {isOpen && filteredTasks.length > 0 && (
        <div className="absolute z-10 min-w-80 w-max max-w-lg mt-1 bg-drip-elevated border border-focus/30 rounded-xl shadow-glass max-h-64 overflow-auto">
          {filteredTasks.map((task) => (
            <div
              key={task.task_id}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectTask(task);
              }}
              className="px-3 py-2.5 hover:bg-focus/5 cursor-pointer transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <div className="flex items-center gap-3">
                <span className="text-focus font-mono shrink-0 w-20">
                  #{task.task_id}
                </span>
                <span className="text-txt-secondary">
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

import { useState, useEffect } from 'react';
import type { TaskCache } from '../../types';

interface TaskDisplayProps {
  taskId: string | null;
  className?: string;
}

/**
 * TaskDisplay - Read-only display of task ID with title from cache
 *
 * Features:
 * - Shows task ID on first line (monospace, blue)
 * - Shows task title on second line (truncated, gray)
 * - Loads title from cache (fast, no API call)
 * - Graceful fallback if title unavailable
 * - Tooltip shows full title on hover
 *
 * @param taskId - The task ID to display (can be null)
 * @param className - Additional CSS classes
 */
export default function TaskDisplay({ taskId, className = '' }: TaskDisplayProps) {
  const [taskData, setTaskData] = useState<TaskCache | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!taskId || taskId.trim() === '') {
      setTaskData(null);
      return;
    }

    setIsLoading(true);

    // Load task from cache
    window.logAPI.getCachedTask(taskId.trim())
      .then((cached) => {
        setTaskData(cached);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load cached task:', error);
        setTaskData(null);
        setIsLoading(false);
      });
  }, [taskId]);

  // No task ID
  if (!taskId || taskId.trim() === '') {
    return (
      <div className={className}>
        <span className="text-xs text-gray-400">No task ID</span>
      </div>
    );
  }

  // Loading state (brief)
  if (isLoading) {
    return (
      <div className={className}>
        <span className="font-mono text-xs text-blue-600">#{taskId.trim()}</span>
        <span className="text-xs text-gray-400 ml-1">...</span>
      </div>
    );
  }

  // Task ID with title
  if (taskData) {
    return (
      <div className={`flex flex-col ${className}`}>
        <span className="font-mono text-xs text-blue-600">#{taskData.task_id}</span>
        <span
          className="text-xs text-gray-500 truncate max-w-48"
          title={taskData.title}
        >
          {taskData.title}
        </span>
      </div>
    );
  }

  // Task ID only (no title in cache)
  return (
    <div className={className}>
      <span className="font-mono text-xs text-blue-600">#{taskId.trim()}</span>
    </div>
  );
}

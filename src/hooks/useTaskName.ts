import { useState, useEffect } from 'react';

export function useTaskName(taskId: string | null): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (!taskId) { setName(null); return; }
    window.logAPI.getCachedTask(taskId).then(task => {
      setName(task?.title || null);
    }).catch(() => setName(null));
  }, [taskId]);
  return name;
}

import { useState, useEffect } from 'react';

// Shared in-memory cache to avoid duplicate API calls across components
const nameCache: Record<string, string> = {};
const pendingFetches = new Set<string>();

async function resolveTaskName(taskId: string): Promise<string | null> {
  if (nameCache[taskId]) return nameCache[taskId];

  // Try local DB cache first
  try {
    const task = await window.logAPI.getCachedTask(taskId);
    if (task?.title) {
      nameCache[taskId] = task.title;
      return task.title;
    }
  } catch {}

  // Fall back to API fetch (also caches in DB via getIssue)
  if (pendingFetches.has(taskId)) return null;
  pendingFetches.add(taskId);
  try {
    const baseUrl = await window.timerAPI.getSettings('apiBaseUrl') || 'https://es.easyproject.com';
    const apiKey = await window.timerAPI.getSettings('apiKey');
    if (!apiKey || !window.timerAPI.getIssue) return null;
    const issue = await window.timerAPI.getIssue(baseUrl, apiKey, taskId);
    if (issue?.title) {
      nameCache[taskId] = issue.title;
      return issue.title;
    }
  } catch {} finally {
    pendingFetches.delete(taskId);
  }
  return null;
}

export function useTaskName(taskId: string | null): string | null {
  const [name, setName] = useState<string | null>(taskId ? nameCache[taskId] || null : null);
  useEffect(() => {
    if (!taskId) { setName(null); return; }
    if (nameCache[taskId]) { setName(nameCache[taskId]); return; }
    resolveTaskName(taskId).then(n => { if (n) setName(n); });
  }, [taskId]);
  return name;
}

export async function resolveTaskNames(taskIds: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  await Promise.all(taskIds.map(async id => {
    const name = await resolveTaskName(id);
    if (name) result[id] = name;
  }));
  return result;
}

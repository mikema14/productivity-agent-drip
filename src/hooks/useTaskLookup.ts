import { useState, useEffect, useRef } from 'react';
import type { TaskCache, IssueData } from '../types';

interface UseTaskLookupOptions {
  debounceMs?: number;
  onTaskFound?: (data: IssueData) => void;
}

interface UseTaskLookupResult {
  taskData: IssueData | TaskCache | null;
  isLoading: boolean;
  error: string | null;
  isValid: boolean;
}

/**
 * Hook for looking up task details with debouncing and caching
 *
 * Features:
 * - 500ms debounce (configurable)
 * - Cache-first strategy (checks local cache before API)
 * - Abort controller for cancelling in-flight requests
 * - Hybrid validation (numeric IDs validated, non-numeric allowed)
 *
 * @param taskId - The task ID to look up (can be null/undefined/empty)
 * @param options - Configuration options
 * @returns Object with taskData, isLoading, error, and isValid
 */
export function useTaskLookup(
  taskId: string | null | undefined,
  options: UseTaskLookupOptions = {}
): UseTaskLookupResult {
  const { debounceMs = 500, onTaskFound } = options;

  const [taskData, setTaskData] = useState<IssueData | TaskCache | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Reset state if taskId is empty
    if (!taskId || taskId.trim() === '') {
      setTaskData(null);
      setIsLoading(false);
      setError(null);
      setIsValid(true);
      return;
    }

    const trimmedTaskId = taskId.trim();

    // Check if it's a numeric ID (should be validated)
    const isNumericId = /^\d+$/.test(trimmedTaskId);

    // Non-numeric IDs are allowed without validation (hybrid approach)
    if (!isNumericId) {
      setTaskData(null);
      setIsLoading(false);
      setError(null);
      setIsValid(true);
      return;
    }

    // Debounce the lookup
    debounceTimerRef.current = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      setIsValid(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // Step 1: Check cache first
        const cachedTask = await window.logAPI.getCachedTask(trimmedTaskId);

        // If request was aborted, don't update state
        if (abortController.signal.aborted) {
          return;
        }

        if (cachedTask) {
          // Found in cache - instant response
          setTaskData(cachedTask);
          setIsLoading(false);
          setIsValid(true);

          // Call callback if provided
          if (onTaskFound) {
            onTaskFound({
              taskId: cachedTask.task_id,
              title: cachedTask.title,
              projectId: cachedTask.project_id,
              projectName: cachedTask.project_name || ''
            });
          }

          return;
        }

        // Step 2: Not in cache - fetch from API
        const settings = {
          apiBaseUrl: await window.timerAPI.getSettings('apiBaseUrl') || 'https://es.easyproject.com',
          apiKey: await window.timerAPI.getSettings('apiKey') || ''
        };

        if (!settings.apiKey) {
          setError('API key not configured');
          setIsLoading(false);
          setIsValid(false);
          return;
        }

        if (!window.timerAPI.getIssue) {
          setError('API not available');
          setIsLoading(false);
          setIsValid(false);
          return;
        }

        const issueData = await window.timerAPI.getIssue(
          settings.apiBaseUrl,
          settings.apiKey,
          trimmedTaskId
        );

        // If request was aborted, don't update state
        if (abortController.signal.aborted) {
          return;
        }

        // Success - task found
        setTaskData(issueData);
        setIsLoading(false);
        setIsValid(true);
        setError(null);

        // Call callback if provided
        if (onTaskFound) {
          onTaskFound(issueData);
        }

      } catch (err: any) {
        // If request was aborted, don't update state
        if (abortController.signal.aborted) {
          return;
        }

        console.error('Task lookup failed:', err);

        // Handle specific error cases
        let errorMessage = 'Failed to fetch task';
        let valid = true;

        if (err.message && err.message.includes('not found')) {
          errorMessage = `Task #${trimmedTaskId} not found`;
          valid = false; // Numeric ID that doesn't exist - invalid
        } else if (err.message && err.message.includes('Invalid API key')) {
          errorMessage = 'Invalid API key';
          valid = false;
        } else if (err.message) {
          errorMessage = err.message;
        }

        setError(errorMessage);
        setTaskData(null);
        setIsValid(valid);
        setIsLoading(false);
      }
    }, debounceMs);

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [taskId, debounceMs, onTaskFound]);

  return {
    taskData,
    isLoading,
    error,
    isValid
  };
}

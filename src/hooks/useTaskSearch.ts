import { useState, useEffect, useRef } from 'react';
import type { TaskCache } from '../types';

interface UseTaskSearchOptions {
  /** Debounce before hitting the DB. Short by default - this is a local SQLite read. */
  debounceMs?: number;
  /** Max rows returned by the search. */
  limit?: number;
}

interface UseTaskSearchResult {
  /** recentTasks when the query is empty, otherwise full-history search results. */
  results: TaskCache[];
  isSearching: boolean;
}

/**
 * useTaskSearch - search the entire task cache, not just recent history.
 *
 * With an empty query this returns `recentTasks` verbatim (no IPC call), so pickers
 * stay short and quiet at rest. As soon as the user types, it queries the full
 * task_cache over IPC by task ID, title and project name.
 *
 * @param query - The search text
 * @param recentTasks - Fallback list shown when the query is empty
 */
export function useTaskSearch(
  query: string,
  recentTasks: TaskCache[],
  options: UseTaskSearchOptions = {}
): UseTaskSearchResult {
  const { debounceMs = 120, limit = 50 } = options;

  const [results, setResults] = useState<TaskCache[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Monotonic request id - guards against out-of-order responses overwriting newer ones
  const requestIdRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = query.trim();

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Empty query - fall back to the recents list, no lookup needed
    if (!trimmed) {
      requestIdRef.current++;
      setResults([]);
      setIsSearching(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    // Drop the previous query's rows right away - otherwise Enter during the
    // debounce would commit a task that doesn't match what was typed.
    setResults([]);
    setIsSearching(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const tasks = (await window.logAPI?.searchTasks?.(trimmed, limit)) ?? [];
        if (requestIdRef.current !== requestId) return;
        setResults(tasks);
      } catch (error) {
        console.error('Task search failed:', error);
        if (requestIdRef.current !== requestId) return;
        setResults([]);
      } finally {
        if (requestIdRef.current === requestId) {
          setIsSearching(false);
        }
      }
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [trimmed, debounceMs, limit]);

  return {
    results: trimmed ? results : recentTasks,
    isSearching: trimmed ? isSearching : false,
  };
}

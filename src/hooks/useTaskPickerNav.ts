import { useState, useMemo, useCallback, useRef } from 'react';
import { useTaskSearch } from './useTaskSearch';
import type { TaskCache, RankedTask } from '../types';

/** A picker row: a cached task, with today's tracked minutes when known. */
export type PickerTask = TaskCache & { todayMinutes?: number };

interface Options {
  recentTasks: RankedTask[];
  onSelect: (task: TaskCache) => void;
}

/**
 * Shared query + keyboard state for the Timer task pickers.
 *
 * Highlight model: `highlighted` is -1 at rest, becomes 0 on focus or typing,
 * and is clamped to the current results at read time (so a highlight survives
 * the empty gap while a search is in flight). Only arrow keys bump `scrollTick`,
 * which is what TaskResultList scrolls on - hover never scrolls.
 */
export function useTaskPickerNav({ recentTasks, onSelect }: Options) {
  const [query, setQueryState] = useState('');
  const [rawHighlighted, setRawHighlighted] = useState(-1);
  const [scrollTick, setScrollTick] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const fetchIdRef = useRef(0);

  const { results: searchResults, isSearching } = useTaskSearch(query, recentTasks);

  // Search results come from task_cache without today's minutes; borrow them from the ranked list.
  const results: PickerTask[] = useMemo(() => {
    if (!query.trim()) return recentTasks;
    const minutes = new Map(recentTasks.map(t => [t.task_id, t.todayMinutes]));
    return searchResults.map(t => ({ ...t, todayMinutes: minutes.get(t.task_id) ?? 0 }));
  }, [query, recentTasks, searchResults]);

  const highlighted = rawHighlighted < 0 || results.length === 0
    ? -1
    : Math.min(rawHighlighted, results.length - 1);

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    setRawHighlighted(0);
  }, []);

  const select = useCallback((task: TaskCache) => {
    setQueryState('');
    setRawHighlighted(-1);
    onSelect(task);
  }, [onSelect]);

  const onFocus = useCallback(() => {
    setRawHighlighted(h => (h < 0 ? 0 : h));
  }, []);

  const onBlur = useCallback(() => {
    setRawHighlighted(-1);
  }, []);

  const onHover = useCallback((index: number) => {
    setRawHighlighted(index);
  }, []);

  const clearQuery = useCallback(() => {
    setQueryState('');
    setRawHighlighted(0);
  }, []);

  const fetchById = async (id: string) => {
    const fetchId = ++fetchIdRef.current;
    setIsFetching(true);
    try {
      const baseUrl = (await window.timerAPI.getSettings('apiBaseUrl')) || '';
      const apiKey = (await window.timerAPI.getSettings('apiKey')) || '';
      if (!baseUrl || !apiKey || !window.timerAPI.getIssue) return;
      const issue = await window.timerAPI.getIssue(baseUrl, apiKey, id);
      if (issue && fetchIdRef.current === fetchId) {
        select({
          task_id: issue.taskId,
          title: issue.title,
          project_id: issue.projectId,
          project_name: issue.projectName,
          last_seen_at: new Date().toISOString(),
        });
      }
    } catch {
      // Not found / offline: leave the query in place so the user can correct it
    } finally {
      if (fetchIdRef.current === fetchId) setIsFetching(false);
    }
  };

  /** Arrow/Enter handling. Returns true when the key was consumed. */
  const handleNavKey = (e: React.KeyboardEvent): boolean => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return true;
      const next = e.key === 'ArrowDown'
        ? Math.min(highlighted + 1, results.length - 1)
        : Math.max(highlighted - 1, 0);
      setRawHighlighted(next);
      setScrollTick(t => t + 1);
      return true;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = query.trim();
      if (highlighted >= 0) {
        select(results[highlighted]);
      } else if (/^\d+$/.test(trimmed)) {
        void fetchById(trimmed);
      }
      return true;
    }
    return false;
  };

  return {
    query,
    setQuery,
    clearQuery,
    results,
    isSearching,
    isFetching,
    highlighted,
    scrollTick,
    onFocus,
    onBlur,
    onHover,
    select,
    handleNavKey,
  };
}

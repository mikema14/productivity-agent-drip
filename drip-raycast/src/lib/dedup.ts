import type { TaskCache, DripListItem, Subtask } from "./types";
import { parseSubtasks } from "./db";

/** Get the effective task ID for a list item: list-level task_id takes priority */
export function effectiveTaskId(li: DripListItem): string | null {
  return li.list_task_id || li.task_id || null;
}

/**
 * Remove list items whose effective task ID already appears in apiTasks.
 * This prevents duplicates when the same task shows up in both sections.
 */
export function deduplicateListItems(
  apiTasks: TaskCache[],
  listItems: DripListItem[]
): DripListItem[] {
  const apiTaskIds = new Set(apiTasks.map((t) => t.task_id));
  return listItems.filter((li) => {
    const eid = effectiveTaskId(li);
    return !eid || !apiTaskIds.has(eid);
  });
}

export interface SubtaskWithSource {
  subtask: Subtask;
  listItemTitle: string;
}

/**
 * Collect all JSON subtasks from list items that match a given task ID.
 * Matches against both item-level task_id and list-level list_task_id.
 */
export function collectSubtasksForTaskId(
  taskId: string,
  listItems: DripListItem[]
): SubtaskWithSource[] {
  const result: SubtaskWithSource[] = [];
  for (const li of listItems) {
    const eid = effectiveTaskId(li);
    if (eid === taskId) {
      for (const subtask of parseSubtasks(li.subtasks)) {
        result.push({ subtask, listItemTitle: li.title });
      }
    }
  }
  return result;
}

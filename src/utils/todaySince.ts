import type { ListItemColumn } from '../types';

/**
 * `list_items.today_since` after a column write (R29): the local date an item
 * entered Today, kept while it stays there (reorders included), null outside
 * Today. Review's `Carried n×` counts the workdays since.
 */
export function todaySinceFor(
  prevColumn: ListItemColumn | null,
  nextColumn: ListItemColumn,
  prevSince: string | null | undefined,
  today: string,
): string | null {
  if (nextColumn !== 'today') return null;
  if (prevColumn === 'today') return prevSince ?? null;
  return today;
}

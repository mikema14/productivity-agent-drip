/**
 * View ids are unchanged from the sidebar era so nothing persisted or
 * deep-linked breaks; the rail only relabels and regroups them.
 */
export type ViewId = 'timer' | 'daily-log' | 'progress' | 'settings' | 'lists' | 'all-lists';

export interface RailItem {
  id: 'timer' | 'plan' | 'review' | 'insights';
  label: string;
  /** The view a click navigates to. */
  target: ViewId;
  /** Views for which this item is highlighted; defaults to `[target]`. */
  matches?: ViewId[];
}

export const RAIL_ITEMS: RailItem[] = [
  { id: 'timer', label: 'Now', target: 'timer' },
  { id: 'plan', label: 'Plan', target: 'all-lists', matches: ['all-lists', 'lists'] },
  { id: 'review', label: 'Review', target: 'daily-log' },
  { id: 'insights', label: 'Insights', target: 'progress' },
];

export function isRailItemActive(item: RailItem, view: ViewId): boolean {
  return (item.matches ?? [item.target]).includes(view);
}

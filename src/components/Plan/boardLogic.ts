import type { ListItem, ListItemColumn, TaskList } from '../../types';
import { parseDbTimestamp } from '../../utils/time';
import { DAY_TARGET_MINUTES } from '../Timer/TimerDayTimeline';

/**
 * Pure logic behind the Plan board. No React, no store: every rule the two
 * legacy boards (AllListsOverview / ListPlanningView) encoded lives here so it
 * can be tested against both old behaviours before any JSX renders.
 */

/** Display order (mockup): Today first. */
export const COLUMNS: { key: ListItemColumn; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'This week' },
  { key: 'backlog', label: 'Backlog' },
];

/** Data order: "Move right" still means "closer to Today" (unchanged semantics). */
export const DATA_ORDER: ListItemColumn[] = ['backlog', 'this_week', 'today'];

export type BoardColumnKey = ListItemColumn | 'done';

const DAY_MS = 86_400_000;
export const STALE_DAYS = 14;

/** §5.3 rule: the list's task id wins over the item's. */
export function effectiveTaskId(item: ListItem, list?: TaskList | null): string | null {
  return list?.task_id || item.task_id || null;
}

/**
 * Where completed items go:
 * - `column`  → a 4th Done column (All tasks, `Done` on)
 * - `hidden`  → not shown at all (All tasks, `Done` off) — P10
 * - `inline`  → in their own column, strikethrough (single list)
 */
export type CompletedMode = 'column' | 'hidden' | 'inline';

export interface PartitionOptions {
  scope: 'all' | 'list';
  listId?: string | null;
  /** All scope only: list ids to keep; empty = every list. */
  filters?: Set<string>;
  completedMode: CompletedMode;
}

export interface ColumnBuckets {
  open: ListItem[];
  done: ListItem[];
}

export interface Partition {
  columns: Record<ListItemColumn, ColumnBuckets>;
  doneColumn: ListItem[];
}

const byOrder = (a: ListItem, b: ListItem) => a.order - b.order;

export function partition(items: ListItem[], opts: PartitionOptions): Partition {
  const columns: Record<ListItemColumn, ColumnBuckets> = {
    today: { open: [], done: [] },
    this_week: { open: [], done: [] },
    backlog: { open: [], done: [] },
  };
  const doneColumn: ListItem[] = [];
  const filterActive = opts.scope === 'all' && !!opts.filters && opts.filters.size > 0;

  for (const item of items) {
    if (item.archived) continue;
    if (opts.scope === 'list' && item.list_id !== opts.listId) continue;
    if (filterActive && !opts.filters!.has(item.list_id)) continue;
    const bucket = columns[item.column];
    if (!bucket) continue;
    if (item.completed === 1) {
      if (opts.completedMode === 'column') doneColumn.push(item);
      else if (opts.completedMode === 'inline') bucket.done.push(item);
    } else {
      bucket.open.push(item);
    }
  }

  for (const key of DATA_ORDER) {
    columns[key].open.sort(byOrder);
    columns[key].done.sort(byOrder);
  }
  doneColumn.sort(byOrder);
  return { columns, doneColumn };
}

export type BacklogGroupKey = 'new' | 'stale' | 'rest';

export interface BacklogGroup {
  key: BacklogGroupKey;
  label: string;
  items: ListItem[];
}

export const BACKLOG_GROUP_LABEL: Record<BacklogGroupKey, string> = {
  new: 'New this week',
  stale: `Older than ${STALE_DAYS} days`,
  rest: 'Everything else',
};

/** Whole days since the item was created; null when `created_at` is unparseable. */
export function ageDays(item: ListItem, now: number): number | null {
  const created = parseDbTimestamp(item.created_at || '');
  if (Number.isNaN(created)) return null;
  return Math.max(0, Math.floor((now - created) / DAY_MS));
}

/** `14d` for stale items, nothing otherwise. */
export function ageBadge(item: ListItem, now: number): string | null {
  const age = ageDays(item, now);
  return age !== null && age >= STALE_DAYS ? `${age}d` : null;
}

/**
 * Backlog groups (P5): created on/after Monday → new; STALE_DAYS or older →
 * stale; everything else. Empty groups are omitted; order inside is preserved.
 */
export function groupBacklog(items: ListItem[], monday: Date, now: number): BacklogGroup[] {
  const groups: Record<BacklogGroupKey, ListItem[]> = { new: [], stale: [], rest: [] };
  const mondayMs = monday.getTime();
  for (const item of items) {
    const created = parseDbTimestamp(item.created_at || '');
    const age = ageDays(item, now);
    if (!Number.isNaN(created) && created >= mondayMs) groups.new.push(item);
    else if (age !== null && age >= STALE_DAYS) groups.stale.push(item);
    else groups.rest.push(item);
  }
  return (['new', 'stale', 'rest'] as BacklogGroupKey[])
    .filter(key => groups[key].length > 0)
    .map(key => ({ key, label: BACKLOG_GROUP_LABEL[key], items: groups[key] }));
}

export interface ListGroup {
  list: TaskList | undefined;
  items: ListItem[];
}

/** Moved verbatim from AllListsOverview: one group per list, in first-seen order. */
export function groupByList(items: ListItem[], lists: TaskList[]): ListGroup[] {
  const groups = new Map<string, ListItem[]>();
  for (const item of items) {
    const existing = groups.get(item.list_id) || [];
    groups.set(item.list_id, [...existing, item]);
  }
  return Array.from(groups.entries()).map(([listId, groupItems]) => ({
    list: lists.find(l => l.id === listId),
    items: groupItems,
  }));
}

export type DropResult =
  | { kind: 'complete' }
  | { kind: 'uncomplete'; column: ListItemColumn }
  | { kind: 'move'; column: ListItemColumn; order: number };

export interface ResolveDropArgs {
  activeId: string;
  overId: string;
  items: ListItem[];
  partition: Partition;
}

function isColumnKey(id: string): id is ListItemColumn {
  return id === 'today' || id === 'this_week' || id === 'backlog';
}

/**
 * Both legacy `handleDragEnd`s in one rule:
 * - over the Done column (or a card in it) → complete
 * - a completed card dragged into an active column → uncomplete there
 * - otherwise → move to the target column at the hovered card's index, or append
 * Completed items never take part in the index (open cards only).
 */
export function resolveDrop({ activeId, overId, items, partition }: ResolveDropArgs): DropResult | null {
  if (activeId === overId) return null;
  const item = items.find(i => i.id === activeId);
  if (!item) return null;

  let target: BoardColumnKey | null = null;
  if (isColumnKey(overId) || overId === 'done') {
    target = overId;
  } else {
    const over = items.find(i => i.id === overId);
    if (over) target = partition.doneColumn.some(d => d.id === over.id) ? 'done' : over.column;
  }
  if (!target) return null;

  if (target === 'done') {
    return item.completed === 1 ? null : { kind: 'complete' };
  }
  if (item.completed === 1) {
    return { kind: 'uncomplete', column: target };
  }
  const targetItems = partition.columns[target].open.filter(i => i.id !== activeId);
  const overIndex = targetItems.findIndex(i => i.id === overId);
  return { kind: 'move', column: target, order: overIndex >= 0 ? overIndex : targetItems.length };
}

/** Hover arrows on the data order: ← towards Backlog, → towards Today. */
export function arrowTargets(column: ListItemColumn): { left: ListItemColumn | null; right: ListItemColumn | null } {
  const i = DATA_ORDER.indexOf(column);
  return {
    left: i > 0 ? DATA_ORDER[i - 1] : null,
    right: i >= 0 && i < DATA_ORDER.length - 1 ? DATA_ORDER[i + 1] : null,
  };
}

/** Lists panel subtitle (P21). */
export function listSubtitle(list: TaskList): string {
  if (list.task_id) return `logs to ${list.task_id}`;
  return list.billable !== 0 ? 'billable' : 'not billable';
}

export interface Provenance {
  kind: 'leexi';
  date: string;
}

const LEEXI_PREFIX = /^From Leexi call: .* \((.+?)\)/;

/** The Leexi sync writes `From Leexi call: <title> (<date>)` into `description` (P6). */
export function provenance(item: ListItem): Provenance | null {
  const m = LEEXI_PREFIX.exec(item.description || '');
  if (!m || !m[1].trim()) return null;
  return { kind: 'leexi', date: m[1].trim() };
}

/** `3h 05m`, `2h`, `25m`, `0m` — hours with zero-padded minutes, minutes dropped when zero. */
export function formatMinutesPadded(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}m`;
}

/** Today capacity line (P8, revised): `3h 05m / 6h focus` against the Phase 1 day target, mirroring the Now screen's `0m / 6h`. */
export function capacityLine(focusMinutes: number): string {
  return `${formatMinutesPadded(focusMinutes)} / ${formatMinutesPadded(DAY_TARGET_MINUTES)} focus`;
}

/** Monday 00:00 local of the week containing `date` (same rule as TimerDayTimeline.getMonday). */
export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** ISO 8601 week number (weeks start Monday; week 1 contains the first Thursday). */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7);
}

/** Monday–Sunday as YYYY-MM-DD for the minutes query. */
export function weekRange(date: Date): { from: string; to: string } {
  const monday = getMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toDateStr(monday), to: toDateStr(sunday) };
}

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `{ week: 39, range: '21–27 Sep' }`; `21 Sep – 4 Oct` when the week crosses a month. */
export function weekLabelParts(date: Date): { week: number; range: string } {
  const monday = getMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const sameMonth = monday.getMonth() === sunday.getMonth() && monday.getFullYear() === sunday.getFullYear();
  const range = sameMonth
    ? `${monday.getDate()}–${sunday.getDate()} ${MONTH[monday.getMonth()]}`
    : `${monday.getDate()} ${MONTH[monday.getMonth()]} – ${sunday.getDate()} ${MONTH[sunday.getMonth()]}`;
  return { week: isoWeek(monday), range };
}

export function weekLabel(date: Date): string {
  const { week, range } = weekLabelParts(date);
  return `Week ${week} · ${range}`;
}

export interface StartCandidate {
  item: ListItem;
  taskId: string;
}

/** First open Today item (by `order`) with an effective task id (P13). */
export function startCandidate(todayOpenItems: ListItem[], lists: TaskList[]): StartCandidate | null {
  const sorted = [...todayOpenItems].sort(byOrder);
  for (const item of sorted) {
    const taskId = effectiveTaskId(item, lists.find(l => l.id === item.list_id));
    if (taskId) return { item, taskId };
  }
  return null;
}

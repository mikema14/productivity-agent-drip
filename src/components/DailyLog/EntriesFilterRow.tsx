import { Pill } from '../shared/Pill';
import CalendarPopover from './CalendarPopover';
import type { EntryFilter } from './reviewLogic';

interface Props {
  filter: EntryFilter;
  onFilterChange: (filter: EntryFilter) => void;
  counts: Record<EntryFilter, number>;
  viewMode: 'list' | 'timeline';
  onViewModeChange: (mode: 'list' | 'timeline') => void;
  groupByTask: boolean;
  onGroupByTaskToggle: () => void;
  showGroupToggle: boolean;
  /** Marked rows `Move to…` would move; the key shows only when > 0. */
  markedCount: number;
  onMoveEntries: () => void;
  onManageTemplates: () => void;
  busy?: boolean;
  /** Move target popover (single row or bulk), anchored to the right group. */
  moveCalendar: { open: boolean; selectedDate: string; onSelect: (date: string) => void; onClose: () => void };
}

const FILTERS: Array<{ id: EntryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'to-log', label: 'To log' },
  { id: 'logged', label: 'Logged' },
];

const TEXT_KEY = 'h-[26px] px-2 border border-drip-border rounded-[2px] font-display text-[12px] text-txt-muted hover:text-txt-primary hover:bg-focus/5 transition-colors whitespace-nowrap disabled:opacity-40 disabled:pointer-events-none';

/**
 * The row between the summary bar and the table (mockup Review.dc.html, R31):
 * the ALL / TO LOG / LOGGED filter on the left and, on the right, the controls
 * the mockup leaves out (R10 → R22): List | Timeline, Group by task, Move to…,
 * Templates. Below `wide:` it scrolls sideways instead of wrapping.
 */
export default function EntriesFilterRow(props: Props) {
  const {
    filter, onFilterChange, counts, viewMode, onViewModeChange, groupByTask, onGroupByTaskToggle, showGroupToggle,
    markedCount, onMoveEntries, onManageTemplates, busy = false, moveCalendar,
  } = props;

  const tab = (id: 'list' | 'timeline', label: string, extra = '') => (
    <button
      type="button"
      onClick={() => onViewModeChange(id)}
      aria-pressed={viewMode === id}
      className={`px-3 h-[26px] now-label transition-colors ${extra} ${
        viewMode === id ? 'bg-focus text-drip-bg' : 'text-txt-muted hover:text-txt-primary hover:bg-focus/5'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      data-testid="entries-toolbar"
      className={`shrink-0 flex items-center justify-between gap-3 whitespace-nowrap ${
        moveCalendar.open ? 'overflow-visible' : 'overflow-x-auto scroll-x-quiet wide:overflow-visible'
      }`}
    >
      {viewMode === 'list' ? (
        <div role="group" aria-label="Filter entries" className="shrink-0 inline-flex border border-drip-border">
          {FILTERS.map((f, i) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => onFilterChange(f.id)}
              className={`h-8 px-3 now-label transition-colors ${i > 0 ? 'border-l border-drip-border' : ''} ${
                filter === f.id ? 'bg-txt-primary text-drip-bg font-semibold' : 'text-txt-secondary hover:text-txt-primary hover:bg-focus/5'
              }`}
            >
              {f.label} {counts[f.id]}
            </button>
          ))}
        </div>
      ) : (
        <span className="now-label text-txt-muted">Every entry of the day</span>
      )}

      <div className="relative shrink-0 flex items-center gap-2">
        <span className="inline-flex border border-drip-border">
          {tab('list', 'List')}
          {tab('timeline', 'Timeline', 'border-l border-drip-border')}
        </span>
        {showGroupToggle && (
          <Pill pressed={groupByTask} onClick={onGroupByTaskToggle} className="whitespace-nowrap">Group by task</Pill>
        )}
        {markedCount > 0 && (
          <button type="button" onClick={onMoveEntries} disabled={busy} className={TEXT_KEY}>Move to…</button>
        )}
        <button type="button" onClick={onManageTemplates} className={TEXT_KEY}>Templates</button>
        {moveCalendar.open && (
          <CalendarPopover selectedDate={moveCalendar.selectedDate} onSelectDate={moveCalendar.onSelect} onClose={moveCalendar.onClose} />
        )}
      </div>
    </div>
  );
}

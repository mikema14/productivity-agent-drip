import type { ReactNode } from 'react';
import KeyButton from '../Timer/KeyButton';
import { Pill } from '../shared/Pill';
import CalendarPopover from './CalendarPopover';
import { ROW_GRID } from './EntryRow';
import { formatMinutesPadded, type DayStats, type SelectionSummary } from './reviewLogic';

interface Props {
  viewMode: 'list' | 'timeline';
  onViewModeChange: (mode: 'list' | 'timeline') => void;
  groupByTask: boolean;
  onGroupByTaskToggle: () => void;
  showGroupToggle: boolean;
  stats: DayStats;
  summary: SelectionSummary;
  onSelectToggle: () => void;
  onMoveEntries: () => void;
  onManageTemplates: () => void;
  onAddEntry: () => void;
  onLogSelected: () => void;
  isLogging: boolean;
  /**
   * A day load is in flight while rows from the previous day are still shown:
   * the bulk keys are disabled so nothing acts on the wrong day's rows.
   */
  busy?: boolean;
  /** Move target popover (single row or bulk), anchored to the toolbar's right group. */
  moveCalendar: { open: boolean; selectedDate: string; onSelect: (date: string) => void; onClose: () => void };
  /** Rows, the timeline, the empty state or the loading text. */
  children: ReactNode;
}

const TEXT_KEY = 'h-[26px] px-2 rounded-[2px] font-display text-[12px] text-txt-muted hover:text-txt-primary hover:bg-focus/5 transition-colors whitespace-nowrap disabled:opacity-40 disabled:pointer-events-none';

/**
 * The `Time entries` section (mockup Review.dc.html:103-161): a 40px toolbar
 * for the controls the mockup omits (R10), the column header, the body at its
 * natural height and the 60px footer with the selection summary and the two
 * keys. The section never scrolls its rows itself: the Review main column does,
 * and the footer sticks to the bottom of that viewport so `Log` stays reachable.
 */
export default function EntriesTable(props: Props) {
  const {
    viewMode, onViewModeChange, groupByTask, onGroupByTaskToggle, showGroupToggle, stats, summary,
    onSelectToggle, onMoveEntries, onManageTemplates, onAddEntry, onLogSelected, isLogging, busy = false, moveCalendar, children,
  } = props;

  const tab = (id: 'list' | 'timeline', label: string, extra = '') => (
    <button
      type="button"
      onClick={() => onViewModeChange(id)}
      aria-pressed={viewMode === id}
      className={`px-3 h-6 now-label transition-colors ${extra} ${
        viewMode === id ? 'bg-focus text-drip-bg' : 'text-txt-muted hover:text-txt-primary hover:bg-focus/5'
      }`}
    >
      {label}
    </button>
  );

  const canLog = summary.selectedCount > 0 && !isLogging && !busy;
  const logLabel = isLogging ? 'Logging…' : summary.selectedCount > 0 ? `Log ${summary.selectedCount} to Easy8` : 'Log to Easy8';

  return (
    <section aria-label="Time entries" className="shrink-0 flex flex-col border border-drip-elevated rounded-[2px]">
      {/* Toolbar. Below `wide:` the section can be ~390px wide: the controls never wrap or
          clip; the row scrolls sideways instead (quiet scrollbar). While the Move popover is
          open the overflow must stay visible or the popover would be clipped by the scroller. */}
      <div
        data-testid="entries-toolbar"
        className={`h-10 shrink-0 px-4 flex items-center justify-between gap-3 border-b border-drip-elevated whitespace-nowrap ${
          moveCalendar.open ? 'overflow-visible' : 'overflow-x-auto scroll-x-quiet wide:overflow-visible'
        }`}
      >
        <div className="shrink-0 flex items-center gap-3">
          <span className="inline-flex border border-drip-border">
            {tab('list', 'List')}
            {tab('timeline', 'Timeline', 'border-l border-drip-border')}
          </span>
          {showGroupToggle && (
            <Pill pressed={groupByTask} onClick={onGroupByTaskToggle} className="whitespace-nowrap">Group by task</Pill>
          )}
        </div>
        <div className="relative shrink-0 flex items-center gap-1">
          {stats.toggleableCount > 0 && (
            <button type="button" onClick={onSelectToggle} disabled={busy} className={TEXT_KEY}>
              {stats.allSelected ? 'Unselect all' : 'Select all'}
            </button>
          )}
          {stats.markedCount > 0 && (
            <button type="button" onClick={onMoveEntries} disabled={busy} className={`${TEXT_KEY} border border-drip-border`}>Move to…</button>
          )}
          <button type="button" onClick={onManageTemplates} className={`${TEXT_KEY} border border-drip-border`}>Templates</button>
          {moveCalendar.open && (
            <CalendarPopover selectedDate={moveCalendar.selectedDate} onSelectDate={moveCalendar.onSelect} onClose={moveCalendar.onClose} />
          )}
        </div>
      </div>

      {/* Column header + body; below `wide:` the grid keeps its width and scrolls sideways (P16 precedent).
          The min height keeps the empty / loading states and the timeline grid visible. */}
      <div data-testid="entries-body" className="overflow-x-auto">
        <div className="min-w-[680px] wide:min-w-0 min-h-[240px] flex flex-col">
          {viewMode === 'list' && (
            <div className={`${ROW_GRID} h-[38px] shrink-0 border-b border-drip-elevated now-label text-txt-muted`} data-testid="entries-columns">
              <span>Time</span><span>Dur</span><span>Task</span><span>Comment</span><span>Billable</span><span>Log</span><span />
            </div>
          )}
          <div className="flex-1 flex flex-col">{children}</div>
        </div>
      </div>

      {/* Footer: sticky to the bottom of the scrolling main column */}
      <div data-testid="entries-footer" className="sticky bottom-0 z-[5] bg-drip-bg h-[60px] shrink-0 px-4 flex items-center justify-between gap-3 border-t border-drip-elevated">
        {/* `N selected` always; the minutes only from `wide:` up so the keys keep their one line */}
        <span className="min-w-0 font-display text-[12.5px] text-txt-muted whitespace-nowrap truncate">
          <span className="font-mono text-txt-primary">{summary.selectedCount}</span> selected
          {summary.selectedCount > 0 && (
            <span className="hidden wide:inline"> · <span className="font-mono text-txt-primary">{formatMinutesPadded(summary.selectedMinutes)}</span></span>
          )}
          {summary.needsTaskCount > 0 && (
            <> · <span className="text-focus">{summary.needsTaskCount} {summary.needsTaskCount === 1 ? 'needs' : 'need'} a task</span></>
          )}
        </span>
        <div className="shrink-0 flex items-center gap-2.5">
          <KeyButton variant="outline" size="md" onClick={onAddEntry} disabled={busy} className="whitespace-nowrap">+ Entry</KeyButton>
          <KeyButton
            variant="amber"
            size="md"
            onClick={onLogSelected}
            disabled={!canLog}
            className="whitespace-nowrap"
            title={summary.selectedCount === 0 ? 'Mark entries to log' : isLogging ? 'Logging…' : busy ? 'Loading the day…' : undefined}
          >
            {logLabel}
          </KeyButton>
        </div>
      </div>
    </section>
  );
}

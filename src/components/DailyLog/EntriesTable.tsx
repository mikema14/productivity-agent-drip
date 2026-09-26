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
  /** Move target popover (single row or bulk), anchored to the toolbar's right group. */
  moveCalendar: { open: boolean; selectedDate: string; onSelect: (date: string) => void; onClose: () => void };
  /** Rows, the timeline, the empty state or the loading text. */
  children: ReactNode;
}

const TEXT_KEY = 'h-[26px] px-2 rounded-[2px] font-display text-[12px] text-txt-muted hover:text-txt-primary hover:bg-focus/5 transition-colors whitespace-nowrap';

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
    onSelectToggle, onMoveEntries, onManageTemplates, onAddEntry, onLogSelected, isLogging, moveCalendar, children,
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

  const canLog = summary.selectedCount > 0 && !isLogging;
  const logLabel = isLogging ? 'Logging…' : summary.selectedCount > 0 ? `Log ${summary.selectedCount} to Easy8` : 'Log to Easy8';

  return (
    <section aria-label="Time entries" className="shrink-0 flex flex-col border border-drip-elevated rounded-[2px]">
      {/* Toolbar */}
      <div data-testid="entries-toolbar" className="h-10 shrink-0 px-4 flex items-center justify-between gap-3 border-b border-drip-elevated">
        <div className="flex items-center gap-3">
          <span className="inline-flex border border-drip-border">
            {tab('list', 'List')}
            {tab('timeline', 'Timeline', 'border-l border-drip-border')}
          </span>
          {showGroupToggle && (
            <Pill pressed={groupByTask} onClick={onGroupByTaskToggle}>Group by task</Pill>
          )}
        </div>
        <div className="relative flex items-center gap-1">
          {stats.toggleableCount > 0 && (
            <button type="button" onClick={onSelectToggle} className={TEXT_KEY}>
              {stats.allSelected ? 'Unselect all' : 'Select all'}
            </button>
          )}
          {stats.markedCount > 0 && (
            <button type="button" onClick={onMoveEntries} className={`${TEXT_KEY} border border-drip-border`}>Move to…</button>
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
        <span className="font-display text-[12.5px] text-txt-muted whitespace-nowrap truncate">
          <span className="font-mono text-txt-primary">{summary.selectedCount}</span> selected
          {summary.selectedCount > 0 && (
            <> · <span className="font-mono text-txt-primary">{formatMinutesPadded(summary.selectedMinutes)}</span></>
          )}
          {summary.needsTaskCount > 0 && (
            <> · <span className="text-focus">{summary.needsTaskCount} {summary.needsTaskCount === 1 ? 'needs' : 'need'} a task</span></>
          )}
        </span>
        <div className="flex items-center gap-2.5">
          <KeyButton variant="outline" size="md" onClick={onAddEntry}>+ Entry</KeyButton>
          <KeyButton
            variant="amber"
            size="md"
            onClick={onLogSelected}
            disabled={!canLog}
            title={summary.selectedCount === 0 ? 'Mark entries to log' : isLogging ? 'Logging…' : undefined}
          >
            {logLabel}
          </KeyButton>
        </div>
      </div>
    </section>
  );
}

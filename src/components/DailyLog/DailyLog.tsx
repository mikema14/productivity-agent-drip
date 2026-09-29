import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useLogStore } from '../../stores/logStore';
import { useShutdownStore } from '../../stores/shutdownStore';
import EntryRow from './EntryRow';
import EntriesTable from './EntriesTable';
import EntriesFilterRow from './EntriesFilterRow';
import LogSummaryBar from './LogSummaryBar';
import AddEntryModal from './AddEntryModal';
import TemplateManagerModal from './TemplateManagerModal';
import TimelineView from './TimelineView';
import EndDayModal from './EndDayModal';
import ReviewHeader from './ReviewHeader';
import TodaysThree from './TodaysThree';
import TomorrowAside from './TomorrowAside';
import { filterEntries, logSummary, shiftDate, todayString, buildEPLink, errorHint, nextWorkday, type EntryFilter } from './reviewLogic';
import type { CalendarProposal } from '../../types';
import type { LogEntry } from '../../stores/logStore';
import { useListsStore } from '../../stores/listsStore';
import type { ViewId } from '../Layout/views';
import { mergeEntriesByTaskId, type MergedEntry } from '../../utils/mergeEntries';
import { forceSyncCalendar, invalidateCalendarCache, syncCalendarProposals } from '../../services/calendar';

interface DailyLogProps {
  /** R18: the 401 banner's `Open Settings` navigates through the App router. */
  onNavigate?: (view: ViewId) => void;
}

const asRow = (e: LogEntry): MergedEntry => ({ ...e, isMerged: false, sourceCount: 1, sourceEntries: [e] });

/**
 * The Review screen (mockup Review.dc.html, R22–R33): logging is the main
 * column — summary bar, filter row, inline-editable table — and closing the
 * day is the optional aside. Enter logs the selection, N adds an entry.
 */
export default function DailyLog({ onNavigate }: DailyLogProps) {
  const {
    entries,
    selectedDate,
    isLoading,
    viewMode,
    setSelectedDate,
    setViewMode,
    loadDay,
    addManualEntry,
    updateEntry,
    deleteEntry,
    toggleLogMark,
    toggleSelectAll,
    logSelected,
    moveEntries,
  } = useLogStore();

  const { isDayLocked } = useShutdownStore();
  const listItems = useListsStore(s => s.items);
  const lists = useListsStore(s => s.lists);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showEndDayModal, setShowEndDayModal] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [isGrouped, setIsGrouped] = useState(false);
  // R31: session state; TO LOG by default, logged rows one `show` away
  const [filter, setFilter] = useState<EntryFilter>('to-log');
  const [dayLocked, setDayLocked] = useState(false);
  const [showMoveCalendar, setShowMoveCalendar] = useState(false);
  const [moveSingleId, setMoveSingleId] = useState<string | null>(null);
  // R18: last log error per entry id; cleared for a row on its next attempt or edit
  const [logErrors, setLogErrors] = useState<Record<string, string>>({});
  // R3: the aside's one-liner is a draft of the modal's Reflection
  const [reflectionDraft, setReflectionDraft] = useState('');
  const [savedReflection, setSavedReflection] = useState<string | null>(null);
  // R4: tomorrow = next workday; null = feed unavailable
  const [tomorrowProposals, setTomorrowProposals] = useState<CalendarProposal[] | null>(null);
  const tomorrowDate = nextWorkday(selectedDate);

  // Auto-dismiss toast after 10 seconds
  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  // Rows on screen: the filter first (so a group never mixes logged and unlogged), then the optional merge
  const mergedEntries = useMemo(() => {
    const filtered = filterEntries(entries, filter);
    return isGrouped ? mergeEntriesByTaskId(filtered) : filtered.map(asRow);
  }, [entries, filter, isGrouped]);

  useEffect(() => {
    loadDay(selectedDate);
  }, [selectedDate, loadDay]);

  // The main process refreshes the ICS feed in the background; the first one
  // after launch replaces whatever the on-disk cache served.
  useEffect(() => {
    return window.timerAPI.onCalendarFeedUpdated?.(async () => {
      invalidateCalendarCache();
      await loadDay(selectedDate);
    });
  }, [selectedDate, loadDay]);

  // Check if day is locked; a locked day shows its saved reflection read-only (R15)
  useEffect(() => {
    let alive = true;
    async function checkLockStatus() {
      const locked = await isDayLocked(selectedDate);
      if (!alive) return;
      setDayLocked(locked);
      if (locked) {
        try {
          const ritual = await window.dashboardAPI.getShutdownRitual(selectedDate);
          if (alive) setSavedReflection(ritual?.reflection ?? null);
        } catch {
          if (alive) setSavedReflection(null);
        }
      } else {
        setSavedReflection(null);
      }
    }
    checkLockStatus();
    return () => { alive = false; };
  }, [selectedDate, isDayLocked]);

  // Tomorrow's meeting load for the aside (R4)
  useEffect(() => {
    let alive = true;
    async function loadTomorrow() {
      try {
        await syncCalendarProposals(tomorrowDate);
        const proposals = await window.logAPI.getCalendarProposals(tomorrowDate);
        if (alive) setTomorrowProposals(proposals);
      } catch (error) {
        console.error('Failed to load tomorrow\'s calendar:', error);
        if (alive) setTomorrowProposals(null);
      }
    }
    loadTomorrow();
    return () => { alive = false; };
  }, [tomorrowDate]);

  const handleDateChange = (days: number) => {
    setSelectedDate(shiftDate(selectedDate, days));
  };

  const handleAddEntry = async (entry: any) => {
    await addManualEntry({ ...entry, startTime: entry.startTime });
  };

  const handleAcceptProposal = async (id: string, taskId?: string) => {
    await window.logAPI.acceptCalendarProposal?.(id, taskId);
    await loadDay(selectedDate, true); // Skip sync - local operation only
  };

  // Handle merged entry interactions
  const handleToggleLogMerged = (entryId: string) => {
    const mergedEntry = mergedEntries.find(e => e.id === entryId);

    if (mergedEntry?.isMerged) {
      // Toggle all source entries
      mergedEntry.sourceEntries.forEach(sourceEntry => {
        toggleLogMark(sourceEntry.id);
      });
    } else {
      // Regular entry
      toggleLogMark(entryId);
    }
  };

  const clearLogError = (ids: string[]) => {
    setLogErrors(prev => {
      if (!ids.some(id => id in prev)) return prev;
      const next = { ...prev };
      ids.forEach(id => { delete next[id]; });
      return next;
    });
  };

  const handleUpdateMerged = async (entryId: string, changes: Partial<LogEntry>) => {
    const mergedEntry = mergedEntries.find(e => e.id === entryId);
    clearLogError(mergedEntry?.isMerged ? mergedEntry.sourceEntries.map(e => e.id) : [entryId]);

    if (mergedEntry?.isMerged) {
      // Update all source entries with the same changes
      // This ensures consistency across merged sessions
      for (const sourceEntry of mergedEntry.sourceEntries) {
        await updateEntry(sourceEntry.id, changes);
      }
      return;
    }

    // Regular entry
    await updateEntry(entryId, changes);
  };

  const handleDeleteMerged = async (entryId: string) => {
    const mergedEntry = mergedEntries.find(e => e.id === entryId);

    if (mergedEntry?.isMerged) {
      // Confirm bulk delete of all source sessions
      const confirmed = window.confirm(
        `Delete all ${mergedEntry.sourceCount} sessions in this merge?\n\nThis cannot be undone.`
      );

      if (!confirmed) return;

      // Delete all source entries
      try {
        for (const sourceEntry of mergedEntry.sourceEntries) {
          await deleteEntry(sourceEntry.id);
        }

        window.timerAPI.showNotification(
          'Sessions Deleted',
          `Successfully deleted ${mergedEntry.sourceCount} sessions`
        );
      } catch (error) {
        console.error('Failed to delete merged entries:', error);
        window.timerAPI.showNotification(
          'Delete Failed',
          'Failed to delete some sessions'
        );
      }
      return;
    }

    // Regular entry
    deleteEntry(entryId);
  };

  // R7: the live Billable key writes through the same merged update path
  const handleToggleBillable = (entryId: string, billable: boolean) => {
    void handleUpdateMerged(entryId, { billable });
  };

  // R26: a task picked in the row; a proposal is accepted with it (R8), any other row is marked to log
  const handleAssignTask = async (entryId: string, taskId: string) => {
    const row = mergedEntries.find(e => e.id === entryId);
    if (row?.isProposal) {
      clearLogError([entryId]);
      await handleAcceptProposal(entryId, taskId);
      return;
    }
    await handleUpdateMerged(entryId, { taskId, markedToLog: true });
  };

  // Stable refs — always point to the latest handler without changing identity
  const handleUpdateMergedRef    = useRef(handleUpdateMerged);
  const handleDeleteMergedRef    = useRef(handleDeleteMerged);
  const handleToggleLogMergedRef = useRef(handleToggleLogMerged);
  const handleAcceptProposalRef  = useRef(handleAcceptProposal);
  const handleAssignTaskRef      = useRef(handleAssignTask);
  const handleToggleBillableRef  = useRef(handleToggleBillable);
  handleUpdateMergedRef.current    = handleUpdateMerged;
  handleDeleteMergedRef.current    = handleDeleteMerged;
  handleToggleLogMergedRef.current = handleToggleLogMerged;
  handleAcceptProposalRef.current  = handleAcceptProposal;
  handleAssignTaskRef.current      = handleAssignTask;
  handleToggleBillableRef.current  = handleToggleBillable;

  const stableUpdate   = useCallback((id: string, changes: Partial<LogEntry>) => handleUpdateMergedRef.current(id, changes), []);
  const stableDelete   = useCallback((id: string)                    => handleDeleteMergedRef.current(id),          []);
  const stableToggle   = useCallback((id: string)                    => handleToggleLogMergedRef.current(id),       []);
  const stableAccept   = useCallback((id: string)                    => handleAcceptProposalRef.current(id),        []);
  const stableAssign   = useCallback((id: string, taskId: string)    => handleAssignTaskRef.current(id, taskId),    []);
  const stableBillable = useCallback((id: string, billable: boolean) => handleToggleBillableRef.current(id, billable), []);

  // Move entries handlers
  const handleMoveSingleRef = useRef((id: string) => {
    setMoveSingleId(id);
    setShowMoveCalendar(true);
  });
  const stableMove = useCallback((id: string) => handleMoveSingleRef.current(id), []);

  const handleMoveConfirm = async (targetDate: string) => {
    setShowMoveCalendar(false);
    const ids = moveSingleId ? [moveSingleId] : undefined;
    setMoveSingleId(null);
    const count = ids ? ids.length : entries.filter(e => e.markedToLog && !e.logged && e.source !== 'break').length;
    try {
      await moveEntries(targetDate, ids);
      window.timerAPI.showNotification(
        'Entries Moved',
        `${count} ${count === 1 ? 'entry' : 'entries'} moved to ${targetDate}`
      );
    } catch (error) {
      console.error('Failed to move entries:', error);
      window.timerAPI.showNotification('Move Failed', 'Could not move entries');
    }
  };

  const handleLogSelected = async () => {
    setIsLogging(true);
    clearLogError(entries.filter(e => e.markedToLog).map(e => e.id));
    try {
      const result = await logSelected();
      if (result.errors.length > 0) {
        setLogErrors(prev => {
          const next = { ...prev };
          result.errors.forEach(({ entryId, error }) => { next[entryId] = error; });
          return next;
        });
      }
      // Show result notification
      if (result.success > 0) {
        setSuccessCount(result.success);
        setShowSuccessToast(true);
      }
      if (result.failed > 0) {
        window.timerAPI.showNotification(
          'Logging Failed',
          `Failed to log ${result.failed} entries`
        );
      }
    } catch (error) {
      console.error('Failed to log entries:', error);
      window.timerAPI.showNotification('Error', 'Failed to log entries');
    } finally {
      setIsLogging(false);
    }
  };

  const handleSyncCalendar = async () => {
    setIsSyncing(true);
    try {
      await forceSyncCalendar(selectedDate);
      await loadDay(selectedDate, true); // Reload entries, skip redundant sync
      window.timerAPI.showNotification('Calendar Refreshed', 'Latest events synced');
    } catch (error) {
      console.error('Failed to sync calendar:', error);
      window.timerAPI.showNotification('Sync Failed', 'Could not refresh calendar');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEndDay = () => {
    setShowEndDayModal(true);
  };

  const handleEndDaySuccess = async () => {
    setShowEndDayModal(false);
    // Refresh the day's lock status
    const locked = await isDayLocked(selectedDate);
    setDayLocked(locked);
    if (locked) {
      const ritual = await window.dashboardAPI.getShutdownRitual(selectedDate).catch(() => null);
      setSavedReflection(ritual?.reflection ?? null);
      setReflectionDraft('');
    }
    // Show success message
    window.timerAPI.showNotification('Day Complete', 'Your shutdown ritual has been saved!');
  };

  // R24: every count over the flat day, never the merged rows
  const summary = useMemo(() => logSummary(entries), [entries]);
  const isToday = selectedDate === todayString();

  const openSettings = onNavigate ? () => onNavigate('settings') : undefined;
  const authError = Object.values(logErrors).find(e => errorHint(e).action === 'settings');
  const rowError = (entry: (typeof mergedEntries)[number]) =>
    entry.isMerged ? entry.sourceEntries.map(e => logErrors[e.id]).find(Boolean) : logErrors[entry.id];

  const renderRow = (entry: (typeof mergedEntries)[number]) => (
    <EntryRow
      key={entry.id}
      entry={entry}
      onUpdate={stableUpdate}
      onDelete={stableDelete}
      onToggleLog={stableToggle}
      onAccept={stableAccept}
      onMove={stableMove}
      onAssignTask={stableAssign}
      onToggleBillable={stableBillable}
      error={rowError(entry)}
      onOpenSettings={openSettings}
    />
  );

  // A day switch keeps the previous day's rows on screen until the new ones land (no
  // flicker), but they must not be actionable meanwhile: main replaced the list with the
  // loading text, so nothing could act on the wrong day. `inert` + no pointer events keeps
  // that guarantee; the bulk keys are disabled through `busy` below.
  const rowsStale = isLoading && entries.length > 0;

  let body;
  if (isLoading && entries.length === 0) {
    body = <div className="flex-1 flex items-center justify-center text-txt-muted font-display text-[13px]">Loading entries...</div>;
  } else if (entries.length === 0) {
    body = (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-txt-muted">
        <p className="font-display text-[14px]">No entries for this day</p>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="h-8 px-3 rounded-[2px] font-display text-[13px] text-focus hover:bg-focus/10 transition-colors"
        >
          Add your first entry
        </button>
      </div>
    );
  } else if (viewMode === 'timeline') {
    body = <TimelineView entries={entries} />;
  } else if (mergedEntries.length === 0) {
    const allLogged = filter === 'to-log' && summary.logged.count > 0;
    body = (
      <div data-testid="entries-empty" className="flex-1 flex flex-col items-center justify-center gap-2 py-10 text-txt-muted">
        <p className="font-display text-[14px]">{allLogged ? 'Everything is logged' : filter === 'logged' ? 'Nothing logged yet' : 'No work entries'}</p>
        {allLogged && (
          <button type="button" onClick={() => setFilter('all')} className="h-8 px-3 rounded-[2px] font-display text-[13px] text-focus hover:bg-focus/10 transition-colors">
            Show logged
          </button>
        )}
      </div>
    );
  } else {
    body = <div>{mergedEntries.map(renderRow)}</div>;
  }
  if (rowsStale) {
    body = (
      <div
        data-testid="entries-stale"
        aria-busy="true"
        {...{ inert: '' }}
        className="flex-1 flex flex-col opacity-50 pointer-events-none transition-opacity duration-150"
      >
        {body}
      </div>
    );
  }

  // Enter = Log, N = + Add entry (R32): only with no field, key or link focused and nothing open over Review
  const canLog = summary.selected.count > 0 && !isLogging && !rowsStale;
  const anyOverlay = showAddModal || showTemplateModal || showEndDayModal || showMoveCalendar;
  const keyState = useRef({ canLog, anyOverlay, busy: rowsStale });
  keyState.current = { canLog, anyOverlay, busy: rowsStale };
  const handleLogSelectedRef = useRef(handleLogSelected);
  handleLogSelectedRef.current = handleLogSelected;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const isEnter = e.key === 'Enter' && !e.shiftKey;
      const isN = e.key === 'n' || e.key === 'N';
      if (!isEnter && !isN) return;
      const { canLog: can, anyOverlay: covered, busy } = keyState.current;
      if (covered || document.querySelector('[role="dialog"]')) return;
      // The target too: an input's own Enter may blur it before the event reaches the window
      const interactive = (el: EventTarget | Element | null) =>
        el instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName) || el.isContentEditable);
      if (interactive(e.target) || interactive(document.activeElement)) return;
      if (isEnter) {
        if (!can) return;
        e.preventDefault();
        void handleLogSelectedRef.current();
      } else {
        if (busy) return;
        e.preventDefault();
        setShowAddModal(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <ReviewHeader
        date={selectedDate}
        today={todayString()}
        onPrev={() => handleDateChange(-1)}
        onNext={() => handleDateChange(1)}
        onSelectDate={setSelectedDate}
        onSync={handleSyncCalendar}
        isSyncing={isSyncing}
        trackedMinutes={summary.trackedMinutes}
        billableMinutes={summary.billableMinutes}
      />

      <div className="flex flex-1 min-h-0">
        {/* Logging is the main job: summary, filter, then the table takes the remaining height and scrolls its rows. */}
        <div data-testid="review-main" className="flex-1 min-w-0 min-h-0 overflow-y-auto px-5 wide:px-7 py-6 gap-4 flex flex-col">
          {authError && (
            <div role="alert" data-testid="auth-banner" className="shrink-0 h-9 px-3 flex items-center justify-between gap-3 border border-alert/40 rounded-[2px] font-display text-[12.5px] text-alert">
              <span className="truncate">Easy8 rejected the request: {authError}</span>
              {openSettings && (
                <button type="button" onClick={openSettings} className="shrink-0 underline hover:text-txt-primary">Open Settings</button>
              )}
            </div>
          )}
          {/* Plan's Today column is not date-specific: only today's review triages it */}
          {isToday && <TodaysThree />}
          <LogSummaryBar summary={summary} onLog={handleLogSelected} isLogging={isLogging} busy={rowsStale} />
          <EntriesFilterRow
            filter={filter}
            onFilterChange={setFilter}
            counts={{ all: summary.toLog.count + summary.logged.count, 'to-log': summary.toLog.count, logged: summary.logged.count }}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            groupByTask={isGrouped}
            onGroupByTaskToggle={() => setIsGrouped(!isGrouped)}
            showGroupToggle={viewMode === 'list' && entries.length > 0}
            markedCount={summary.selected.count}
            onMoveEntries={() => { setMoveSingleId(null); setShowMoveCalendar(true); }}
            onManageTemplates={() => setShowTemplateModal(true)}
            busy={rowsStale}
            moveCalendar={{
              open: showMoveCalendar,
              selectedDate,
              onSelect: handleMoveConfirm,
              onClose: () => { setShowMoveCalendar(false); setMoveSingleId(null); },
            }}
          />
          <EntriesTable
            viewMode={viewMode}
            summary={summary}
            onSelectToggle={toggleSelectAll}
            onAddEntry={() => setShowAddModal(true)}
            showingLogged={filter !== 'to-log'}
            onToggleLogged={() => setFilter(f => (f === 'to-log' ? 'all' : 'to-log'))}
            isToday={isToday}
            busy={rowsStale}
          >
            {body}
          </EntriesTable>
        </div>
        <TomorrowAside
          date={selectedDate}
          isToday={selectedDate === todayString()}
          todayItems={listItems.filter(i => i.column === 'today')}
          lists={lists}
          proposals={tomorrowProposals}
          reflection={reflectionDraft}
          onReflectionChange={setReflectionDraft}
          locked={dayLocked}
          savedReflection={savedReflection}
          onEndDay={handleEndDay}
        />
      </div>

      {/* Add Entry Modal */}
      {showAddModal && (
        <AddEntryModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddEntry}
        />
      )}

      {/* End Day Modal */}
      {showEndDayModal && (
        <EndDayModal
          date={selectedDate}
          onClose={() => setShowEndDayModal(false)}
          onSuccess={handleEndDaySuccess}
          initialReflection={reflectionDraft}
          tomorrowDate={tomorrowDate}
        />
      )}

      {/* Template Manager Modal */}
      <TemplateManagerModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
      />

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-4 right-4 bg-drip-elevated border border-break/40 text-break px-4 py-3 rounded-[2px] shadow-glass-sm flex items-center gap-4 z-50 font-display text-[13px]">
          <span>✓ {successCount} {successCount === 1 ? 'entry' : 'entries'} logged</span>
          <button
            type="button"
            onClick={() => window.timerAPI?.openExternal?.(buildEPLink(selectedDate))}
            className="underline font-medium hover:text-txt-primary"
          >
            View in Easy Project →
          </button>
          <button
            type="button"
            onClick={() => setShowSuccessToast(false)}
            aria-label="Dismiss"
            className="text-txt-muted hover:text-txt-primary text-lg leading-none"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

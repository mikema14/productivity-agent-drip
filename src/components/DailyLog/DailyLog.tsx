import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useLogStore } from '../../stores/logStore';
import { useShutdownStore } from '../../stores/shutdownStore';
import EntryRow from './EntryRow';
import AddEntryModal from './AddEntryModal';
import ControlBar from './ControlBar';
import TemplateManagerModal from './TemplateManagerModal';
import ViewToggle from './ViewToggle';
import TimelineView from './TimelineView';
import TimelineItem from '../shared/TimelineItem';
import EndDayModal from './EndDayModal';
import CalendarPopover from './CalendarPopover';
import ReviewHeader from './ReviewHeader';
import { dayStats, shiftDate, todayString, buildEPLink } from './reviewLogic';
import type { ViewId } from '../Layout/views';
import { mergeEntriesByTaskId } from '../../utils/mergeEntries';
import { forceSyncCalendar, getLastSyncTime, invalidateCalendarCache } from '../../services/calendar';

interface DailyLogProps {
  /** R18: the 401 banner's `Open Settings` navigates through the App router. */
  onNavigate?: (view: ViewId) => void;
}

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

  const [showAddModal, setShowAddModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showEndDayModal, setShowEndDayModal] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [isGrouped, setIsGrouped] = useState(false);
  const [dayLocked, setDayLocked] = useState(false);
  const [showMoveCalendar, setShowMoveCalendar] = useState(false);
  const [moveSingleId, setMoveSingleId] = useState<string | null>(null);

  // Auto-dismiss toast after 10 seconds
  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  // Merge entries by task ID for display (toggleable)
  const mergedEntries = useMemo(
    () => isGrouped ? mergeEntriesByTaskId(entries) : entries.map(e => ({
      ...e,
      isMerged: false,
      sourceCount: 1,
      sourceEntries: [e]
    })),
    [entries, isGrouped]
  );

  useEffect(() => {
    loadDay(selectedDate);
    const syncTime = getLastSyncTime(selectedDate);
    setLastSyncTime(syncTime);
  }, [selectedDate, loadDay]);

  // The main process refreshes the ICS feed in the background; the first one
  // after launch replaces whatever the on-disk cache served.
  useEffect(() => {
    return window.timerAPI.onCalendarFeedUpdated?.(async () => {
      invalidateCalendarCache();
      await loadDay(selectedDate);
      setLastSyncTime(getLastSyncTime(selectedDate));
    });
  }, [selectedDate, loadDay]);

  // Check if day is locked
  useEffect(() => {
    async function checkLockStatus() {
      const locked = await isDayLocked(selectedDate);
      setDayLocked(locked);
    }
    checkLockStatus();
  }, [selectedDate, isDayLocked]);

  const handleDateChange = (days: number) => {
    setSelectedDate(shiftDate(selectedDate, days));
  };

  const handleAddEntry = async (entry: any) => {
    await addManualEntry({ ...entry, startTime: entry.startTime });
  };

  const handleAcceptProposal = async (id: string) => {
    await window.logAPI.acceptCalendarProposal?.(id);
    await loadDay(selectedDate, true); // Skip sync - local operation only
  };

  const handleDismissProposal = async (id: string) => {
    await window.logAPI.dismissCalendarProposal?.(id);
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

  const handleUpdateMerged = async (entryId: string, changes: any) => {
    const mergedEntry = mergedEntries.find(e => e.id === entryId);

    if (mergedEntry?.isMerged) {
      // Update all source entries with the same changes
      // This ensures consistency across merged sessions
      for (const sourceEntry of mergedEntry.sourceEntries) {
        await updateEntry(sourceEntry.id, changes);
      }
      return;
    }

    // Regular entry
    updateEntry(entryId, changes);
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

  // Stable refs — always point to the latest handler without changing identity
  const handleUpdateMergedRef    = useRef(handleUpdateMerged);
  const handleDeleteMergedRef    = useRef(handleDeleteMerged);
  const handleToggleLogMergedRef = useRef(handleToggleLogMerged);
  const handleAcceptProposalRef  = useRef(handleAcceptProposal);
  const handleDismissProposalRef = useRef(handleDismissProposal);
  handleUpdateMergedRef.current    = handleUpdateMerged;
  handleDeleteMergedRef.current    = handleDeleteMerged;
  handleToggleLogMergedRef.current = handleToggleLogMerged;
  handleAcceptProposalRef.current  = handleAcceptProposal;
  handleDismissProposalRef.current = handleDismissProposal;

  const stableUpdate  = useCallback((id: string, changes: any) => handleUpdateMergedRef.current(id, changes), []);
  const stableDelete  = useCallback((id: string)               => handleDeleteMergedRef.current(id),          []);
  const stableToggle  = useCallback((id: string)               => handleToggleLogMergedRef.current(id),       []);
  const stableAccept  = useCallback((id: string)               => handleAcceptProposalRef.current(id),        []);
  const stableDismiss = useCallback((id: string)               => handleDismissProposalRef.current(id),       []);

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
    try {
      const result = await logSelected();
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
      const syncTime = getLastSyncTime(selectedDate);
      setLastSyncTime(syncTime);
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
    // Show success message
    window.timerAPI.showNotification('Day Complete', 'Your shutdown ritual has been saved!');
  };

  const stats = useMemo(() => dayStats(mergedEntries), [mergedEntries]);
  const { workEntries } = useMemo(() => ({
    workEntries: mergedEntries.filter(e => e.source !== 'break'),
  }), [mergedEntries]);
  const { markedCount, toggleableCount, allSelected } = stats;

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
        stats={stats}
      />

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-txt-muted">Loading entries...</div>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-txt-muted">
            <p className="text-lg">No entries for this day</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 text-sm text-focus hover:bg-focus/10 rounded"
            >
              Add your first entry
            </button>
          </div>
        ) : (
          <div className="p-4 h-full overflow-auto">
            <div className="max-w-6xl mx-auto">
              <ControlBar
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                groupByTask={isGrouped}
                onGroupByTaskToggle={() => setIsGrouped(!isGrouped)}
                showGroupToggle={viewMode === 'list' && entries.length > 0}
                onAddEntry={() => setShowAddModal(true)}
                onManageTemplates={() => setShowTemplateModal(true)}
                onSyncCalendar={handleSyncCalendar}
                onEndDay={handleEndDay}
                onSelectToggle={toggleSelectAll}
                onLogSelected={handleLogSelected}
                onMoveEntries={() => { setMoveSingleId(null); setShowMoveCalendar(true); }}
                isDayLocked={dayLocked}
                isSyncing={isSyncing}
                markedCount={markedCount}
                toggleableCount={toggleableCount}
                allSelected={allSelected}
                isLogging={isLogging}
              />

              {showMoveCalendar && (
                <div className="relative z-50">
                  <CalendarPopover
                    selectedDate={selectedDate}
                    onSelectDate={handleMoveConfirm}
                    onClose={() => setShowMoveCalendar(false)}
                  />
                </div>
              )}

              {viewMode === 'timeline' ? (
                <TimelineView entries={entries} />
              ) : (
                <div className="overflow-hidden">
                  {workEntries.map((entry, index) => (
                    <TimelineItem
                      key={entry.id}
                      timestamp={entry.startTime}
                      isFirst={index === 0}
                      isLast={index === workEntries.length - 1}
                      isMerged={entry.isMerged}
                      sourceCount={entry.sourceCount}
                    >
                      <EntryRow
                        entry={entry}
                        inTimeline={true}
                        onUpdate={stableUpdate}
                        onDelete={stableDelete}
                        onToggleLog={stableToggle}
                        onAccept={stableAccept}
                        onDismiss={stableDismiss}
                        onMove={stableMove}
                      />
                    </TimelineItem>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
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
        />
      )}

      {/* Template Manager Modal */}
      <TemplateManagerModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
      />

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-4 right-4 bg-emerald-500/90 backdrop-blur-sm border border-emerald-500/30 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-4 z-50">
          <span>✓ {successCount} {successCount === 1 ? 'entry' : 'entries'} logged</span>
          <button
            onClick={() => window.timerAPI?.openExternal?.(buildEPLink(selectedDate))}
            className="underline font-medium hover:text-emerald-100"
          >
            View in Easy Project →
          </button>
          <button
            onClick={() => setShowSuccessToast(false)}
            className="text-emerald-200 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useMemo } from 'react';
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
import { mergeEntriesByTaskId } from '../../utils/mergeEntries';
import { forceSyncCalendar, getLastSyncTime } from '../../services/calendar';

export default function DailyLog() {
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

  // Auto-dismiss toast after 10 seconds
  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  const buildEPLink = (date: string): string => {
    const params = new URLSearchParams({
      only_me: 'true',
      set_filter: '1',
      spent_on: `${date}|${date}`,
      user_id: '28668'
    });
    return `https://es.easyproject.com/easy_time_entries?${params}`;
  };

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

  // Check if day is locked
  useEffect(() => {
    async function checkLockStatus() {
      const locked = await isDayLocked(selectedDate);
      setDayLocked(locked);
    }
    checkLockStatus();
  }, [selectedDate, isDayLocked]);

  const handleDateChange = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) {
      return 'Today';
    } else if (dateStr === yesterday.toISOString().split('T')[0]) {
      return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const workEntries = mergedEntries.filter(e => e.source !== 'break');
  const breakEntries = mergedEntries.filter(e => e.source === 'break');
  const totalDuration = workEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const totalBreakMinutes = breakEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const markedCount = mergedEntries.filter(e => e.markedToLog && !e.logged).length;
  const loggedCount = mergedEntries.filter(e => e.logged).length;
  const toggleableCount = mergedEntries.filter(e => !e.logged && !e.isProposal && e.source !== 'break').length;
  const allSelected = toggleableCount > 0 && markedCount === toggleableCount;

  const formatTotalTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header - Simplified single row */}
      <div className="flex-none px-6 py-4 border-b border-focus/20">
        <div className="flex items-center justify-between">
          {/* Left: Title + Date Navigation */}
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-display font-semibold text-txt-primary">Daily Log</h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleDateChange(-1)}
                className="px-2 py-1 text-txt-muted text-sm rounded-xl hover:bg-focus/5 hover:text-txt-secondary transition-all"
              >
                ←
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1 text-txt-secondary text-sm rounded-xl hover:bg-focus/5 flex items-center gap-1.5 transition-all"
              >
                <span>{formatDate(selectedDate)}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSyncCalendar();
                  }}
                  disabled={isSyncing}
                  className="text-txt-muted hover:text-txt-primary disabled:opacity-50"
                  title={isSyncing ? 'Syncing calendar...' : 'Sync calendar'}
                >
                  <span className={isSyncing ? 'animate-spin' : ''}>🔄</span>
                </button>
              </button>
              <button
                onClick={() => handleDateChange(1)}
                className="px-2 py-1 text-txt-muted text-sm rounded-xl hover:bg-focus/5 hover:text-txt-secondary transition-all"
              >
                →
              </button>
            </div>
          </div>

          {/* Right: Stats as plain text */}
          <div className="flex items-center gap-2 text-sm text-txt-muted">
            <span className="font-medium">Total: {formatTotalTime(totalDuration)}</span>
            {totalBreakMinutes > 0 && (
              <>
                <span>·</span>
                <span className="text-emerald-400">{totalBreakMinutes}m break</span>
              </>
            )}
            {markedCount > 0 && (
              <>
                <span>·</span>
                <span className="text-focus">{markedCount} to log</span>
              </>
            )}
            {loggedCount > 0 && (
              <>
                <span>·</span>
                <span className="text-emerald-400">{loggedCount} logged</span>
              </>
            )}
          </div>
        </div>
      </div>

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
                isDayLocked={dayLocked}
                isSyncing={isSyncing}
                markedCount={markedCount}
                toggleableCount={toggleableCount}
                allSelected={allSelected}
                isLogging={isLogging}
              />

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
                        onUpdate={handleUpdateMerged}
                        onDelete={handleDeleteMerged}
                        onToggleLog={handleToggleLogMerged}
                        onAccept={handleAcceptProposal}
                        onDismiss={handleDismissProposal}
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

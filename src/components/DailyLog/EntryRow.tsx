import { useState, useEffect, memo } from 'react';
import type { LogEntry } from '../../stores/logStore';
import type { MergedEntry } from '../../utils/mergeEntries';
import TaskIdInput from '../shared/TaskIdInput';
import TaskDisplay from '../shared/TaskDisplay';
import BillableToggle from '../shared/BillableToggle';

interface EntryRowProps {
  entry: MergedEntry;
  onUpdate: (id: string, changes: Partial<LogEntry>) => void;
  onDelete: (id: string) => void;
  onToggleLog: (id: string) => void;
  onAccept?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onMove?: (id: string) => void;
  inTimeline?: boolean;  // Adjusts styling when in timeline
}

function EntryRow({ entry, onUpdate, onDelete, onToggleLog, onAccept, onDismiss, onMove, inTimeline = false }: EntryRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedEntry, setEditedEntry] = useState(entry);

  // Keep the edit buffer in sync with the latest entry prop. The row is memo-ized
  // and persists across reloads, so without this the buffer would be a stale
  // mount-time snapshot and Save could revert fields (e.g. billable) to old values.
  useEffect(() => {
    if (!isEditing) setEditedEntry(entry);
  }, [entry, isEditing]);

  const isBreak = entry.source === 'break';

  const handleTaskSelect = (taskId: string, title: string) => {
    if (entry.type === 'calendar') {
      // Keep original event name; copy it to comment if comment is empty
      setEditedEntry({
        ...editedEntry,
        taskId,
        comment: editedEntry.comment || editedEntry.title,
      });
    } else {
      setEditedEntry({ ...editedEntry, taskId, title });
    }
  };

  const handleSave = () => {
    onUpdate(entry.id, {
      taskId: editedEntry.taskId,
      title: editedEntry.title,
      comment: editedEntry.comment,
      durationMinutes: editedEntry.durationMinutes,
      billable: editedEntry.billable,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedEntry(entry);
    setIsEditing(false);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  const getTypeBadge = () => {
    const badgeLabel = isBreak ? 'break' : entry.type;
    switch (badgeLabel) {
      case 'pomodoro':
        return 'bg-focus/10 text-focus border border-focus/20';
      case 'break':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'adhoc':
        return 'bg-focus/5 text-txt-secondary border border-focus/20';
      case 'calendar':
        return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      default:
        return 'bg-focus/5 text-txt-secondary border border-focus/20';
    }
  };

  const getBadgeLabel = () => {
    return isBreak ? 'break' : entry.type;
  };

  if (isEditing) {
    const editContainerClass = inTimeline
      ? 'py-2 bg-focus/5 border border-focus/20 rounded-xl'
      : 'px-6 py-4 bg-focus/5 border border-focus/20 rounded-xl';
    return (
      <div className={editContainerClass}>
        <div className="space-y-3">
          {/* Row 1: Inputs for Task ID and Title */}
          <div className="flex gap-3">
            <div className="w-32">
              <TaskIdInput
                value={editedEntry.taskId || ''}
                onChange={(value) => setEditedEntry({ ...editedEntry, taskId: value })}
                onTaskSelect={handleTaskSelect}
                placeholder="Task ID"
              />
            </div>
            <input
              type="text"
              value={editedEntry.title}
              onChange={(e) => setEditedEntry({ ...editedEntry, title: e.target.value })}
              placeholder="Title"
              className="flex-1 px-3 py-2 text-sm bg-transparent border border-focus/30 text-txt-primary placeholder-txt-dim rounded-xl focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
            />
            <input
              type="number"
              value={editedEntry.durationMinutes}
              onChange={(e) => setEditedEntry({ ...editedEntry, durationMinutes: parseInt(e.target.value) || 0 })}
              min="1"
              placeholder="Duration"
              className="w-24 px-3 py-2 text-sm bg-transparent border border-focus/30 text-txt-primary placeholder-txt-dim rounded-xl focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
            />
          </div>

          {/* Row 2: Comment */}
          <input
            type="text"
            value={editedEntry.comment || ''}
            onChange={(e) => setEditedEntry({ ...editedEntry, comment: e.target.value })}
            placeholder="Comment"
            className="w-full px-3 py-2 text-sm bg-transparent border border-focus/30 text-txt-primary placeholder-txt-dim rounded-xl focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
          />

          {/* Row 3: Billable and Actions */}
          <div className="flex items-center justify-between">
            <BillableToggle
              checked={editedEntry.billable ?? true}
              onChange={(v) => setEditedEntry({ ...editedEntry, billable: v })}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm bg-focus text-drip-bg font-display font-medium rounded-xl hover:bg-focus/90"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm bg-transparent border border-focus/20 text-txt-muted rounded-xl hover:bg-focus/5 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Card layout for non-edit mode
  const containerClass = inTimeline
    ? `py-2 hover:bg-focus/5 rounded ${entry.logged ? 'bg-emerald-500/5' : ''} ${isBreak ? 'bg-emerald-500/5' : ''}`
    : `px-6 py-4 border-b border-focus/20 hover:bg-focus/5 ${entry.logged ? 'bg-emerald-500/5' : ''} ${isBreak ? 'bg-emerald-500/5' : ''}`;

  return (
    <div className={containerClass}>
      {/* Row 1: Checkbox/Check | Title + Badges | Duration | Time */}
      <div className="flex items-start gap-4 mb-2">
        {/* Checkbox or Checkmark */}
        <div className="flex-shrink-0 pt-1">
          {isBreak ? (
            <span className="text-emerald-400 text-lg opacity-50">~</span>
          ) : entry.logged ? (
            <span className="text-emerald-400 text-lg">✓</span>
          ) : entry.isProposal ? (
            <span className="text-txt-dim">-</span>
          ) : (
            <input
              type="checkbox"
              checked={entry.markedToLog}
              onChange={(e) => {
                e.stopPropagation();
                onToggleLog(entry.id);
              }}
              className="w-5 h-5 cursor-pointer accent-focus"
            />
          )}
        </div>

        {/* Title + Badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-txt-primary truncate">{entry.title}</span>
            <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getTypeBadge()}`}>
              {getBadgeLabel()}
            </span>
            {entry.isMerged && (
              <span className="inline-block px-2 py-1 text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded font-medium">
                {entry.sourceCount} sessions
              </span>
            )}
          </div>
        </div>

        {/* Duration */}
        <div className="flex-shrink-0">
          <span className="font-mono font-medium text-txt-primary">{formatDuration(entry.durationMinutes)}</span>
        </div>
      </div>

      {/* Row 2: Comment */}
      {!isBreak && (
        <div className="ml-9 mb-2">
          <span className="text-sm text-txt-muted italic">
            {entry.comment || 'No comment'}
          </span>
        </div>
      )}

      {/* Row 3: Task ID | Billable | Actions */}
      <div className="ml-9 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Task ID - hide for breaks */}
          {!isBreak && <TaskDisplay taskId={entry.taskId} />}

          {/* Billable Badge - hide for breaks */}
          {!isBreak && (
            entry.billable ? (
              <span className="text-xs text-emerald-400">✓ Billable</span>
            ) : (
              <span className="text-xs text-txt-dim">Not billable</span>
            )
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {!entry.logged && (
            <>
              {entry.isProposal && onAccept && onDismiss && (
                <>
                  <button
                    onClick={() => onAccept(entry.id)}
                    className="px-3 py-1 text-sm bg-emerald-500/80 text-white rounded hover:bg-emerald-500"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => onDismiss(entry.id)}
                    className="px-3 py-1 text-sm bg-transparent border border-focus/20 text-txt-muted rounded-xl hover:bg-focus/5 transition-all"
                  >
                    Dismiss
                  </button>
                </>
              )}
              {!entry.isProposal && (
                <>
                  {!isBreak && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-1 text-sm text-focus hover:bg-focus/10 rounded"
                    >
                      Edit
                    </button>
                  )}
                  {onMove && !entry.logged && (
                    <button
                      onClick={() => onMove(entry.id)}
                      className="px-3 py-1 text-sm text-txt-muted hover:bg-focus/5 rounded"
                    >
                      Move
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(entry.id)}
                    className="px-3 py-1 text-sm text-red-400 hover:bg-red-500/10 rounded"
                    title={entry.isMerged ? `Delete all ${entry.sourceCount} sessions` : 'Delete this entry'}
                  >
                    Delete
                  </button>
                  {entry.isMerged && !isBreak && (
                    <span className="text-xs text-txt-dim italic">
                      {entry.sourceCount} sessions
                    </span>
                  )}
                </>
              )}
            </>
          )}
          {entry.logged && (
            <span className="text-sm text-emerald-400 font-medium">Logged to Easy Project</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(EntryRow, (prev, next) =>
  prev.entry.id              === next.entry.id &&
  prev.entry.source          === next.entry.source &&
  prev.entry.type            === next.entry.type &&
  prev.entry.title           === next.entry.title &&
  prev.entry.taskId          === next.entry.taskId &&
  prev.entry.durationMinutes === next.entry.durationMinutes &&
  prev.entry.comment         === next.entry.comment &&
  prev.entry.billable        === next.entry.billable &&
  prev.entry.markedToLog     === next.entry.markedToLog &&
  prev.entry.logged          === next.entry.logged &&
  prev.entry.isProposal      === next.entry.isProposal &&
  prev.onMove                === next.onMove
);

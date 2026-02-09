import { useState } from 'react';
import type { LogEntry } from '../../stores/logStore';
import type { MergedEntry } from '../../utils/mergeEntries';
import TaskIdInput from '../shared/TaskIdInput';
import TaskDisplay from '../shared/TaskDisplay';

interface EntryRowProps {
  entry: LogEntry | MergedEntry;
  onUpdate: (id: string, changes: Partial<LogEntry>) => void;
  onDelete: (id: string) => void;
  onToggleLog: (id: string) => void;
  onAccept?: (id: string) => void;
  onDismiss?: (id: string) => void;
  inTimeline?: boolean;  // Adjusts styling when in timeline
}

export default function EntryRow({ entry, onUpdate, onDelete, onToggleLog, onAccept, onDismiss, inTimeline = false }: EntryRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedEntry, setEditedEntry] = useState(entry);

  const handleTaskSelect = (taskId: string, title: string) => {
    setEditedEntry({ ...editedEntry, taskId, title });
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'pomodoro':
        return 'bg-red-100 text-red-700';
      case 'adhoc':
        return 'bg-gray-100 text-gray-600';
      case 'calendar':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isEditing) {
    const editContainerClass = inTimeline
      ? 'py-2 bg-blue-50 rounded'
      : 'px-6 py-4 border-b border-gray-100 bg-blue-50';
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
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              value={editedEntry.durationMinutes}
              onChange={(e) => setEditedEntry({ ...editedEntry, durationMinutes: parseInt(e.target.value) || 0 })}
              min="1"
              placeholder="Duration"
              className="w-24 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Row 2: Comment */}
          <input
            type="text"
            value={editedEntry.comment || ''}
            onChange={(e) => setEditedEntry({ ...editedEntry, comment: e.target.value })}
            placeholder="Comment"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Row 3: Billable and Actions */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editedEntry.billable ?? true}
                onChange={(e) => setEditedEntry({ ...editedEntry, billable: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">Billable</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
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
    ? `py-2 hover:bg-gray-50 rounded ${entry.logged ? 'bg-green-50/30' : ''}`
    : `px-6 py-4 border-b border-gray-100 hover:bg-gray-50 ${entry.logged ? 'bg-green-50/50' : ''}`;

  return (
    <div className={containerClass}>
      {/* Row 1: Checkbox/Check | Title + Badges | Duration | Time */}
      <div className="flex items-start gap-4 mb-2">
        {/* Checkbox or Checkmark */}
        <div className="flex-shrink-0 pt-1">
          {entry.logged ? (
            <span className="text-green-600 text-lg">✓</span>
          ) : entry.isProposal ? (
            <span className="text-gray-400">-</span>
          ) : (
            <input
              type="checkbox"
              checked={entry.markedToLog}
              onChange={(e) => {
                e.stopPropagation();
                onToggleLog(entry.id);
              }}
              className="w-5 h-5 cursor-pointer"
            />
          )}
        </div>

        {/* Title + Badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 truncate">{entry.title}</span>
            <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getTypeColor(entry.type)}`}>
              {entry.type}
            </span>
            {entry.isMerged && (
              <span className="inline-block px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded font-medium">
                {entry.sourceCount} sessions
              </span>
            )}
          </div>
        </div>

        {/* Duration */}
        <div className="flex-shrink-0">
          <span className="font-mono font-medium text-gray-900">{formatDuration(entry.durationMinutes)}</span>
        </div>
      </div>

      {/* Row 2: Comment */}
      <div className="ml-9 mb-2">
        <span className="text-sm text-gray-600 italic">
          {entry.comment || 'No comment'}
        </span>
      </div>

      {/* Row 3: Task ID | Billable | Actions */}
      <div className="ml-9 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Task ID */}
          <TaskDisplay taskId={entry.taskId} />

          {/* Billable Badge */}
          {entry.billable ? (
            <span className="text-xs text-green-600">✓ Billable</span>
          ) : (
            <span className="text-xs text-gray-400">Not billable</span>
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
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => onDismiss(entry.id)}
                    className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Dismiss
                  </button>
                </>
              )}
              {!entry.isProposal && (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(entry.id)}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                    title={entry.isMerged ? `Delete all ${entry.sourceCount} sessions` : 'Delete this entry'}
                  >
                    Delete
                  </button>
                  {entry.isMerged && (
                    <span className="text-xs text-gray-400 italic">
                      {entry.sourceCount} sessions
                    </span>
                  )}
                </>
              )}
            </>
          )}
          {entry.logged && (
            <span className="text-sm text-green-600 font-medium">Logged to Easy Project</span>
          )}
        </div>
      </div>
    </div>
  );
}

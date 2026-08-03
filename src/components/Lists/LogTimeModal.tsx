import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getCurrentDate, formatDate, addDays } from '../../utils/time';

export type LogTimeMode = 'local' | 'now';

interface LogTimeModalProps {
  taskTitle: string;
  taskId: string | null;
  billable: boolean;
  onClose: () => void;
  onSubmit: (
    mode: LogTimeMode,
    values: { durationMinutes: number; date: string; comment: string | null }
  ) => Promise<void>;
}

const DURATION_PRESETS = [15, 30, 60, 120];

export default function LogTimeModal({ taskTitle, taskId, billable, onClose, onSubmit }: LogTimeModalProps) {
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [date, setDate] = useState(getCurrentDate());
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState<LogTimeMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = getCurrentDate();
  const yesterday = formatDate(addDays(new Date(), -1));

  const handleSubmit = async (mode: LogTimeMode) => {
    setError(null);

    if (durationMinutes <= 0) {
      setError('Duration must be greater than 0');
      return;
    }

    setSubmitting(mode);
    try {
      await onSubmit(mode, { durationMinutes, date, comment: comment.trim() || null });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log time');
    } finally {
      setSubmitting(null);
    }
  };

  const isBusy = submitting !== null;

  // Portalled to <body>: the task panel's backdrop-blur (and dnd-kit's transform
  // while sorting) makes it the containing block for fixed-position children,
  // which would otherwise crop this dialog to the kanban column.
  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
      // Synthetic events still bubble through the React tree from a portal, so the
      // draggable card's dnd-kit listeners would otherwise still see these.
      onPointerDown={e => e.stopPropagation()}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        className="bg-drip-bg/95 backdrop-blur-2xl border border-focus/30 rounded-2xl shadow-glass w-full max-w-md mx-4 animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-focus/20">
          <h2 className="text-base font-display font-semibold text-txt-primary">Log Time</h2>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="text-txt-secondary truncate">{taskTitle}</span>
            {taskId ? (
              <span className="font-mono text-focus shrink-0">{taskId}</span>
            ) : (
              <span className="text-txt-dim shrink-0">no task ID</span>
            )}
            <span className="px-2 py-0.5 rounded-full bg-focus/5 border border-focus/20 text-txt-muted shrink-0">
              {billable ? 'Billable' : 'Non-billable'}
            </span>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="px-4 py-3 text-sm bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-txt-secondary mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              value={durationMinutes}
              onChange={e => setDurationMinutes(parseInt(e.target.value) || 0)}
              min="1"
              step="1"
              autoFocus
              disabled={isBusy}
              className="w-full px-3 py-2 bg-transparent border border-focus/30 text-txt-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-focus/30 transition-all"
            />
            <div className="mt-2 flex gap-2">
              {DURATION_PRESETS.map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  disabled={isBusy}
                  className="px-3 py-1 text-sm bg-transparent border border-focus/20 text-txt-secondary hover:bg-focus/5 rounded-xl transition-colors disabled:opacity-40"
                >
                  {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-txt-secondary mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              disabled={isBusy}
              className="w-full px-3 py-2 bg-transparent border border-focus/30 text-txt-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-focus/30 transition-all"
            />
            <div className="mt-2 flex gap-2">
              {[{ label: 'Today', value: today }, { label: 'Yesterday', value: yesterday }].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDate(opt.value)}
                  disabled={isBusy}
                  className={`px-3 py-1 text-sm rounded-xl border transition-colors disabled:opacity-40 ${
                    date === opt.value
                      ? 'bg-focus/15 border-focus/30 text-focus'
                      : 'bg-transparent border-focus/20 text-txt-secondary hover:bg-focus/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-txt-secondary mb-1">
              Comment (optional)
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={taskTitle}
              rows={3}
              disabled={isBusy}
              className="w-full px-3 py-2 bg-transparent border border-focus/30 text-txt-primary placeholder-txt-dim rounded-xl focus:outline-none focus:ring-2 focus:ring-focus/30 transition-all"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-focus/20 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="px-4 py-2 text-sm bg-transparent border border-focus/20 text-txt-secondary rounded-xl hover:bg-focus/5 transition-all disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('local')}
            disabled={isBusy}
            title="Save to today's log without sending it to Easy Project"
            className="px-4 py-2 text-sm bg-transparent border border-focus/20 text-txt-secondary rounded-xl hover:bg-focus/5 transition-all disabled:opacity-40"
          >
            {submitting === 'local' ? 'Saving…' : 'Add to Log'}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('now')}
            disabled={isBusy || !taskId}
            title={taskId ? 'Post this time entry to Easy Project now' : 'Add a Task ID to log to Easy Project'}
            className="px-4 py-2 text-sm font-medium bg-focus text-drip-bg rounded-xl hover:bg-focus/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting === 'now' ? 'Logging…' : 'Log Now'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

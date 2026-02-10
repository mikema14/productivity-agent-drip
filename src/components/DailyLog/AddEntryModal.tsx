import { useState, useEffect } from 'react';
import TaskIdInput from '../shared/TaskIdInput';
import type { LogTemplate } from '../../types';

interface AddEntryModalProps {
  onClose: () => void;
  onAdd: (entry: {
    durationMinutes: number;
    title: string;
    taskId: string | null;
    comment: string | null;
    billable: boolean;
  }) => Promise<void>;
}

export default function AddEntryModal({ onClose, onAdd }: AddEntryModalProps) {
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [title, setTitle] = useState('');
  const [taskId, setTaskId] = useState('');
  const [comment, setComment] = useState('');
  const [billable, setBillable] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<LogTemplate[]>([]);

  // Fetch templates on mount
  useEffect(() => {
    if (window.logAPI?.getTemplates) {
      window.logAPI.getTemplates().then(setTemplates).catch(console.error);
    }
  }, []);

  const handleTaskSelect = (selectedTaskId: string, taskTitle: string) => {
    setTaskId(selectedTaskId);
    if (!title) {
      setTitle(taskTitle);
    }
  };

  const applyTemplate = (template: LogTemplate) => {
    setTitle(template.name);
    setDurationMinutes(template.default_duration || 30);
    setTaskId(template.task_id || '');
    setBillable(template.billable === 1);
    setComment(template.comment || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (durationMinutes <= 0) {
      setError('Duration must be greater than 0');
      return;
    }

    setIsSubmitting(true);

    try {
      await onAdd({
        durationMinutes,
        title: title.trim(),
        taskId: taskId.trim() || null,
        comment: comment.trim() || null,
        billable,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-surface-elevated w-full max-w-lg mx-4">
        <div className="px-6 py-4 border-b border-glass-border">
          <h2 className="text-xl font-display font-semibold text-txt-primary">Add Manual Entry</h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
              {error}
            </div>
          )}

          {/* Template Selector */}
          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-txt-secondary mb-2">
                Quick Templates
              </label>
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className="px-3 py-1.5 text-sm bg-focus/10 text-focus border border-focus/20 rounded-xl hover:bg-focus/20 transition-colors"
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-txt-secondary mb-1">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What did you work on?"
              className="w-full px-3 py-2 bg-glass-bg border border-glass-border text-txt-primary placeholder-txt-dim rounded-xl focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30 transition-all"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-txt-secondary mb-1">
              Duration (minutes) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
              min="1"
              step="1"
              className="w-full px-3 py-2 bg-glass-bg border border-glass-border text-txt-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30 transition-all"
              disabled={isSubmitting}
            />
            <div className="mt-2 flex gap-2">
              {[15, 30, 60, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  className="px-3 py-1 text-sm bg-glass-bg border border-glass-border text-txt-secondary hover:bg-glass-hover rounded-xl transition-colors"
                  disabled={isSubmitting}
                >
                  {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-txt-secondary mb-1">
              Task ID (optional)
            </label>
            <TaskIdInput
              value={taskId}
              onChange={setTaskId}
              onTaskSelect={handleTaskSelect}
              placeholder="e.g., 643749"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-txt-secondary mb-1">
              Comment (optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Additional details..."
              rows={3}
              className="w-full px-3 py-2 bg-glass-bg border border-glass-border text-txt-primary placeholder-txt-dim rounded-xl focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30 transition-all"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
                className="w-4 h-4 text-focus border-glass-border rounded focus:ring-focus/30"
                disabled={isSubmitting}
              />
              <span className="text-sm font-medium text-txt-secondary">
                Billable
              </span>
            </label>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-glass-border flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="glass-button text-txt-secondary"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium bg-focus text-drip-bg rounded-xl hover:bg-focus/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Adding...' : 'Add Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import TaskIdInput from '../shared/TaskIdInput';
import BillableToggle from '../shared/BillableToggle';
import type { LogTemplate } from '../../types';

interface AddEntryModalProps {
  onClose: () => void;
  onAdd: (entry: {
    durationMinutes: number;
    title: string;
    taskId: string | null;
    comment: string | null;
    billable: boolean;
    startTime: string | null;
  }) => Promise<void>;
}

export default function AddEntryModal({ onClose, onAdd }: AddEntryModalProps) {
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [title, setTitle] = useState('');
  const [taskId, setTaskId] = useState('');
  const [comment, setComment] = useState('');
  const [billable, setBillable] = useState(true);
  const [startTime, setStartTime] = useState<string>(
    () => {
      const now = new Date();
      return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }
  );
  const [hasStartTime, setHasStartTime] = useState(true);
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
    // Pre-fill billable from the task's default (list item > list > global).
    window.listsAPI?.getBillableForTask?.(selectedTaskId)
      .then(setBillable)
      .catch(() => {});
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
        startTime: hasStartTime ? startTime : null,
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
      <div className="bg-drip-bg/95 backdrop-blur-2xl border border-focus/30 rounded-[2px] shadow-glass w-full max-w-lg mx-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="px-6 py-4 border-b border-focus/20">
          <h2 className="text-xl font-display font-semibold text-txt-primary">Add Manual Entry</h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-alert/10 border border-alert/20 text-alert rounded-[2px]">
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
                    className="px-3 py-1.5 text-sm bg-focus/10 text-focus border border-focus/20 rounded-[2px] hover:bg-focus/20 transition-colors"
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
              className="w-full px-3 py-2 bg-transparent border border-focus/30 text-txt-primary placeholder-txt-dim rounded-[2px] focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30 transition-all"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-txt-secondary mb-1">
              Start Time
              {hasStartTime && (
                <button
                  type="button"
                  onClick={() => setHasStartTime(false)}
                  className="ml-2 text-xs text-txt-muted hover:text-txt-secondary transition-colors"
                >
                  Clear
                </button>
              )}
            </label>
            {hasStartTime ? (
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-transparent border border-focus/30 text-txt-primary rounded-[2px] focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30 transition-all"
                disabled={isSubmitting}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setHasStartTime(true);
                  const now = new Date();
                  setStartTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
                }}
                className="w-full px-3 py-2 bg-transparent border border-focus/30 border-dashed text-txt-muted rounded-[2px] hover:bg-focus/5 transition-colors text-sm text-left"
              >
                No start time (unscheduled) — click to set
              </button>
            )}
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
              className="w-full px-3 py-2 bg-transparent border border-focus/30 text-txt-primary rounded-[2px] focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30 transition-all"
              disabled={isSubmitting}
            />
            <div className="mt-2 flex gap-2">
              {[15, 30, 60, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  className="px-3 py-1 text-sm bg-transparent border border-focus/20 text-txt-secondary hover:bg-focus/5 rounded-[2px] transition-colors"
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
              className="w-full px-3 py-2 bg-transparent border border-focus/30 text-txt-primary placeholder-txt-dim rounded-[2px] focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30 transition-all"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-txt-secondary">Billable</span>
            <BillableToggle checked={billable} onChange={setBillable} disabled={isSubmitting} />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-focus/20 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-transparent border border-focus/20 text-txt-secondary rounded-[2px] hover:bg-focus/5 transition-all"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium bg-focus text-drip-bg rounded-[2px] hover:bg-focus/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Adding...' : 'Add Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}

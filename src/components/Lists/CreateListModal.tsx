import { useState } from 'react';
import { LIST_COLORS, DEFAULT_LIST_COLOR } from '../../utils/listColors';
import { useListsStore } from '../../stores/listsStore';
import TaskIdInput from '../shared/TaskIdInput';

interface CreateListModalProps {
  onClose: () => void;
}

export default function CreateListModal({ onClose }: CreateListModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_LIST_COLOR);
  const [taskId, setTaskId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createList = useListsStore(s => s.createList);
  const lists = useListsStore(s => s.lists);

  const handleTaskSelect = (selectedTaskId: string, title: string) => {
    setTaskId(selectedTaskId);
    if (!name) setName(title);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await createList({
        name: name.trim(),
        color,
        icon_path: null,
        task_id: taskId.trim() || null,
        order: lists.length,
        archived: 0,
      });
      onClose();
    } catch (error) {
      console.error('Failed to create list:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-surface-elevated w-full max-w-md mx-4">
        {/* Header */}
        <div className="px-6 pt-6 pb-2 flex items-center justify-between">
          <h2 className="text-xl font-display font-semibold text-txt-primary">Create a new list</h2>
          <button onClick={onClose} className="text-txt-muted hover:text-txt-secondary transition-colors">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 5l10 10M15 5l-10 10" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Icon preview */}
          <div className="flex justify-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-display font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              {name ? name[0].toUpperCase() : 'L'}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-sm text-txt-secondary mb-2">Pick a list color</label>
            <div className="flex gap-3 justify-center">
              {LIST_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                  style={{ backgroundColor: c }}
                >
                  {color === c && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3.5 8.5l3 3 6-6" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Name input */}
          <div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="List name"
              className="w-full px-4 py-2.5 bg-glass-bg border border-glass-border text-txt-primary placeholder-txt-dim rounded-xl focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30 transition-all font-display"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>

          {/* Optional Task ID */}
          <div>
            <label className="block text-sm text-txt-secondary mb-1">
              Easy Project Task ID <span className="text-txt-muted">(optional)</span>
            </label>
            <TaskIdInput
              value={taskId}
              onChange={setTaskId}
              onTaskSelect={handleTaskSelect}
              placeholder="Bind to task ID..."
            />
            {taskId && (
              <p className="text-xs text-txt-muted mt-1">
                Tasks in this list will use this ID when selected in the timer.
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-glass-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 glass-button text-txt-secondary rounded-full py-2.5"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || isSubmitting}
            className="flex-1 py-2.5 text-sm font-medium rounded-full transition-colors disabled:opacity-40"
            style={{ backgroundColor: color, color: '#fff' }}
          >
            {isSubmitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

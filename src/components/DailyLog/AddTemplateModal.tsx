import { useState } from 'react';

interface AddTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: {
    name: string;
    task_id: string;
    default_duration: number | null;
    billable: boolean;
  }) => Promise<void>;
}

export default function AddTemplateModal({ isOpen, onClose, onSave }: AddTemplateModalProps) {
  const [name, setName] = useState('');
  const [taskId, setTaskId] = useState('');
  const [duration, setDuration] = useState('15');
  const [billable, setBillable] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !taskId.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        task_id: taskId.trim(),
        default_duration: duration ? parseInt(duration) : null,
        billable
      });

      // Reset form
      setName('');
      setTaskId('');
      setDuration('15');
      setBillable(true);
      onClose();
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          Add Quick Log Template
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Template Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Admin, Meeting"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Task ID
              </label>
              <input
                type="text"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                onBlur={() => {
                  // Seed billable from the task's default (list item > list > global).
                  if (taskId.trim()) {
                    window.listsAPI?.getBillableForTask?.(taskId.trim())
                      .then(setBillable)
                      .catch(() => {});
                  }
                }}
                placeholder="e.g., 229602"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Default Duration (minutes)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="15"
                min="1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="billable"
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="billable" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Billable
              </label>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import type { LogTemplate } from '../../types';
import AddTemplateModal from './AddTemplateModal';

interface TemplateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplatesChanged?: () => void;
}

export default function TemplateManagerModal({ isOpen, onClose, onTemplatesChanged }: TemplateManagerModalProps) {
  const [templates, setTemplates] = useState<LogTemplate[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LogTemplate | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      const data = await window.logAPI.getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const handleSaveTemplate = async (template: {
    name: string;
    task_id: string;
    default_duration: number | null;
    billable: boolean;
    comment?: string;
  }) => {
    try {
      if (editingTemplate) {
        // Update existing template
        await window.logAPI.updateTemplate(editingTemplate.id, template);
      } else {
        // Add new template
        await window.logAPI.addTemplate(template);
      }
      await loadTemplates();
      onTemplatesChanged?.();
      setIsAddModalOpen(false);
      setEditingTemplate(null);
    } catch (error) {
      console.error('Failed to save template:', error);
      throw error;
    }
  };

  const handleEdit = (template: LogTemplate) => {
    setEditingTemplate(template);
    setIsAddModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await window.logAPI.deleteTemplate(id);
      await loadTemplates();
      onTemplatesChanged?.();
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('Failed to delete template');
    }
  };

  const handleAddNew = () => {
    setEditingTemplate(null);
    setIsAddModalOpen(true);
  };

  const handleModalClose = () => {
    setIsAddModalOpen(false);
    setEditingTemplate(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="glass-surface-elevated w-full max-w-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-display font-semibold text-txt-primary">
              Manage Templates
            </h2>
            <button
              onClick={onClose}
              className="text-txt-muted hover:text-txt-primary"
            >
              ✕
            </button>
          </div>

          <div className="mb-4">
            <button
              onClick={handleAddNew}
              className="px-4 py-2 bg-focus text-drip-bg font-display font-medium rounded-xl hover:bg-focus/90"
            >
              + Add Template
            </button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {templates.length === 0 ? (
              <p className="text-txt-muted text-center py-8">
                No templates yet. Click "Add Template" to create one.
              </p>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-3 bg-glass-bg border border-glass-border rounded-xl"
                >
                  <div className="flex-1">
                    <div className="font-medium text-txt-primary">
                      {template.name}
                    </div>
                    <div className="text-sm text-txt-muted">
                      Task {template.task_id} · {template.default_duration || 15}m ·{' '}
                      {template.billable ? 'Billable' : 'Non-billable'}
                      {template.comment && (
                        <span className="block mt-0.5 italic">"{template.comment}"</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(template)}
                      className="px-3 py-1 text-sm text-focus hover:bg-focus/10 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="px-3 py-1 text-sm text-red-400 hover:bg-red-500/10 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full glass-button text-txt-muted px-4 py-2"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <EditTemplateModal
        isOpen={isAddModalOpen}
        onClose={handleModalClose}
        onSave={handleSaveTemplate}
        template={editingTemplate}
      />
    </>
  );
}

// Extended version of AddTemplateModal that supports editing
interface EditTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: {
    name: string;
    task_id: string;
    default_duration: number | null;
    billable: boolean;
    comment?: string;
  }) => Promise<void>;
  template: LogTemplate | null;
}

function EditTemplateModal({ isOpen, onClose, onSave, template }: EditTemplateModalProps) {
  const [name, setName] = useState('');
  const [taskId, setTaskId] = useState('');
  const [duration, setDuration] = useState('15');
  const [billable, setBillable] = useState(true);
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Update form when template changes
  useEffect(() => {
    if (template) {
      setName(template.name);
      setTaskId(template.task_id);
      setDuration(template.default_duration?.toString() || '15');
      setBillable(!!template.billable);
      setComment(template.comment || '');
    } else {
      setName('');
      setTaskId('');
      setDuration('15');
      setBillable(true);
      setComment('');
    }
  }, [template]);

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
        billable,
        comment: comment.trim() || undefined
      });

      // Reset form only if adding (not editing)
      if (!template) {
        setName('');
        setTaskId('');
        setDuration('15');
        setBillable(true);
        setComment('');
      }
      onClose();
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 bg-glass-bg border border-glass-border text-txt-primary placeholder-txt-dim rounded-xl focus:ring-2 focus:ring-focus/30 focus:border-focus/30";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
      <div className="glass-surface-elevated w-full max-w-md p-6">
        <h2 className="text-xl font-display font-semibold mb-4 text-txt-primary">
          {template ? 'Edit Template' : 'Add Quick Log Template'}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-txt-secondary mb-1">
                Template Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Admin, Meeting"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-txt-secondary mb-1">
                Task ID
              </label>
              <input
                type="text"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                placeholder="e.g., 229602"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-txt-secondary mb-1">
                Default Duration (minutes)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="15"
                min="1"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-txt-secondary mb-1">
                Default Comment (optional)
              </label>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="e.g., Team meeting, Admin work"
                className={inputClass}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="billable"
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
                className="w-4 h-4 accent-focus"
              />
              <label htmlFor="billable" className="ml-2 text-sm font-medium text-txt-secondary">
                Billable
              </label>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 glass-button text-txt-muted px-4 py-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-focus text-drip-bg font-display font-medium rounded-xl disabled:opacity-50 hover:bg-focus/90"
            >
              {isSaving ? 'Saving...' : template ? 'Update Template' : 'Save Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

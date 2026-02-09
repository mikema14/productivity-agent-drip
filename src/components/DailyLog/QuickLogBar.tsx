import { useEffect, useState } from 'react';
import { useLogStore } from '../../stores/logStore';
import type { LogTemplate } from '../../types';

interface QuickLogBarProps {
  currentDate: string;
  onOpenTemplateManager: () => void;
}

export default function QuickLogBar({ currentDate, onOpenTemplateManager }: QuickLogBarProps) {
  const [templates, setTemplates] = useState<LogTemplate[]>([]);
  const { addManualEntry } = useLogStore();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await window.logAPI.getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const handleTemplateClick = async (template: LogTemplate) => {
    try {
      await addManualEntry({
        date: currentDate,
        durationMinutes: template.default_duration || 15,
        title: template.name,
        taskId: template.task_id,
        billable: !!template.billable,
        markedToLog: true,
        logged: false,
        isTodo: false,
        completed: false,
        comment: template.comment || null
      });
    } catch (error) {
      console.error('Failed to add entry from template:', error);
    }
  };

  if (templates.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Quick Log:</span>
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => handleTemplateClick(template)}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 rounded-md border border-blue-200 dark:border-blue-800 transition-colors"
            title={`Task ${template.task_id} - ${template.default_duration || 15}m`}
          >
            {template.name}
          </button>
        ))}
        <button
          onClick={onOpenTemplateManager}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md border border-gray-300 dark:border-gray-600 transition-colors"
        >
          + Manage
        </button>
      </div>
    </div>
  );
}

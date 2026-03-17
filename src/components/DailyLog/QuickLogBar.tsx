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
    <div className="mb-4 p-3 bg-transparent border border-focus/30 backdrop-blur-sm rounded-xl">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-txt-muted">Quick Log:</span>
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => handleTemplateClick(template)}
            className="px-3 py-1.5 text-sm font-medium text-focus bg-focus/10 hover:bg-focus/20 rounded-lg border border-focus/20 transition-colors"
            title={`Task ${template.task_id} - ${template.default_duration || 15}m`}
          >
            {template.name}
          </button>
        ))}
        <button
          onClick={onOpenTemplateManager}
          className="px-3 py-1.5 bg-transparent border border-focus/20 text-txt-muted text-sm font-medium rounded-xl hover:bg-focus/5 transition-all"
        >
          + Manage
        </button>
      </div>
    </div>
  );
}

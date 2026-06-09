import { useState, useRef, useEffect } from 'react';
import type { ListItemColumn } from '../../types';
import BillableToggle from '../shared/BillableToggle';

interface AddItemInlineProps {
  listId: string;
  column: ListItemColumn;
  showTaskId?: boolean;
  /** The parent list's billable default — seeds the toggle for new items. */
  defaultBillable?: boolean;
  onAdd: (title: string, taskId: string | null, billable: boolean) => Promise<void>;
  onCancel: () => void;
}

export default function AddItemInline({ showTaskId, defaultBillable = true, onAdd, onCancel }: AddItemInlineProps) {
  const [title, setTitle] = useState('');
  const [taskId, setTaskId] = useState('');
  const [billable, setBillable] = useState(defaultBillable);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await onAdd(title.trim(), taskId.trim() || null, billable);
    setTitle('');
    setTaskId('');
    setBillable(defaultBillable);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task name..."
        className="w-full px-3 py-2 bg-transparent border border-focus/20 text-txt-primary placeholder-txt-dim rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-focus/30 transition-all"
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') onCancel();
        }}
      />
      {showTaskId && (
        <input
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          placeholder="Task ID (optional)"
          className="w-full px-3 py-1.5 bg-transparent border border-focus/20 text-txt-primary placeholder-txt-dim rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-focus/30 transition-all"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') onCancel();
          }}
        />
      )}
      {showTaskId && (
        <BillableToggle checked={billable} onChange={setBillable} size="sm" />
      )}
      <div className="flex gap-1.5">
        <button
          onClick={handleSubmit}
          disabled={!title.trim()}
          className="px-3 py-1 text-xs font-medium bg-focus/15 text-focus rounded-lg hover:bg-focus/25 transition-colors disabled:opacity-40"
        >
          Add
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs text-txt-muted hover:text-txt-secondary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

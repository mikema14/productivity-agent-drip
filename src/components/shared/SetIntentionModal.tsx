import { useState } from 'react';

interface Props {
  intentions: string[];
  onAdd: (text: string) => void;
  onRemove: (index: number) => void;
  onClose: () => void;
}

export default function SetIntentionModal({ intentions, onAdd, onRemove, onClose }: Props) {
  const [draft, setDraft] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && draft.trim()) {
      e.preventDefault();
      onAdd(draft.trim());
      setDraft('');
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-drip-surface border border-focus/20 rounded-2xl shadow-glass max-w-sm w-full mx-4 animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h3 className="text-base font-display font-semibold text-txt-primary">Today's intentions</h3>
          <button
            onClick={onClose}
            className="text-txt-dim hover:text-txt-muted w-6 h-6 flex items-center justify-center rounded-md hover:bg-focus/5 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="1" y1="1" x2="11" y2="11" />
              <line x1="11" y1="1" x2="1" y2="11" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-4 space-y-2">
          {intentions.map((intention, i) => (
            <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 bg-focus/5 border border-focus/15 rounded-xl group">
              <span className="text-sm text-txt-secondary">{intention}</span>
              <button
                onClick={() => onRemove(i)}
                className="text-txt-dim hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs w-5 h-5 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          ))}

          {intentions.length < 3 && (
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What will you focus on today? (Enter to add)"
              className="w-full px-3 py-2 bg-transparent border border-focus/25 rounded-xl text-sm
                         text-txt-primary placeholder-txt-dim focus:outline-none focus:ring-2 focus:ring-focus/30"
            />
          )}
          {intentions.length >= 3 && (
            <p className="text-xs text-txt-dim px-1">Max 3 intentions per day</p>
          )}
        </div>

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full h-10 rounded-xl bg-focus/10 border border-focus/20 text-txt-secondary text-sm
                       hover:bg-focus/15 transition-all duration-150"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

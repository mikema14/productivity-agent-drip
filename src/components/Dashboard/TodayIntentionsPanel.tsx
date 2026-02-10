import { useState } from 'react';
import { useIntentionsStore } from '../../stores/intentionsStore';

export default function TodayIntentionsPanel() {
  const { getIntentions, addIntention, removeIntention } = useIntentionsStore();
  const today = new Date().toISOString().split('T')[0];
  const intentions = getIntentions(today);

  const [newIntention, setNewIntention] = useState('');

  const handleAdd = async () => {
    if (!newIntention.trim()) return;

    if (intentions.length >= 3) {
      alert('Recommended max 3 intentions per day');
      return;
    }

    await addIntention(today, newIntention.trim());
    setNewIntention('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  const handleRemove = async (index: number) => {
    await removeIntention(today, index);
  };

  return (
    <div className="glass-surface p-6">
      <h2 className="text-lg font-display font-semibold text-txt-primary mb-4">Today's Intentions</h2>

      {/* Intentions Chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {intentions.map((intention, index) => (
          <div
            key={index}
            className="group inline-flex items-center gap-2 px-4 py-2 bg-focus/10 text-focus border border-focus/20 rounded-full text-sm font-medium hover:bg-focus/20 transition-colors"
          >
            <span className="flex items-center gap-1">
              <span className="text-focus">⚡</span>
              {intention}
            </span>
            <button
              onClick={() => handleRemove(index)}
              className="opacity-0 group-hover:opacity-100 text-focus/60 hover:text-focus transition-opacity"
              aria-label="Remove intention"
            >
              ✕
            </button>
          </div>
        ))}

        {intentions.length === 0 && (
          <p className="text-txt-muted text-sm py-1">No intentions set for today</p>
        )}
      </div>

      {/* Inline Add Input */}
      <input
        type="text"
        value={newIntention}
        onChange={(e) => setNewIntention(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Add intention..."
        className="w-full px-4 py-2 bg-glass-bg border border-glass-border rounded-full text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30 transition-all"
      />
    </div>
  );
}

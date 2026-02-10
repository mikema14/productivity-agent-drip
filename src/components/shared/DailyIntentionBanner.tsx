import { useState, useEffect } from 'react';
import { useIntentionsStore } from '../../stores/intentionsStore';
import { useShutdownStore } from '../../stores/shutdownStore';

export default function DailyIntentionBanner() {
  const { getIntentions, addIntention, removeIntention } = useIntentionsStore();
  const { loadRitual, getRitual } = useShutdownStore();
  const today = new Date().toISOString().split('T')[0];
  const intentions = getIntentions(today);

  const [isEditing, setIsEditing] = useState(false);
  const [newIntention, setNewIntention] = useState('');
  const [showYesterdayNotes, setShowYesterdayNotes] = useState(false);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = yesterday.toISOString().split('T')[0];

  useEffect(() => {
    loadRitual(yesterdayDate);
  }, [yesterdayDate, loadRitual]);

  const yesterdayRitual = getRitual(yesterdayDate);

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
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setNewIntention('');
    }
  };

  const handleRemove = async (index: number) => {
    await removeIntention(today, index);
  };

  if (intentions.length === 0 && !isEditing) {
    return (
      <div className="mb-4 p-3 bg-glass-bg border border-glass-border rounded-xl">
        <div className="flex items-center justify-between">
          <span className="text-sm text-txt-muted italic">No intentions set for today</span>
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs px-3 py-1 bg-focus/10 text-focus rounded-lg hover:bg-focus/20 transition-colors"
          >
            Set Intention
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 p-3 bg-glass-bg border border-glass-border rounded-xl">
      <div className="flex items-start gap-2">
        <span className="text-focus text-lg flex-shrink-0 mt-0.5">⚡</span>

        <div className="flex-1 min-w-0">
          {intentions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {intentions.map((intention, index) => (
                <div
                  key={index}
                  className="group inline-flex items-center gap-1.5 px-3 py-1 bg-drip-elevated text-txt-secondary rounded-full text-sm border border-glass-border hover:border-glass-hover transition-colors"
                >
                  <span>{intention}</span>
                  <button
                    onClick={() => handleRemove(index)}
                    className="opacity-0 group-hover:opacity-100 text-txt-muted hover:text-red-400 transition-opacity text-xs"
                    aria-label="Remove intention"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {yesterdayRitual?.notes && (
            <div className="mb-2">
              <button
                onClick={() => setShowYesterdayNotes(!showYesterdayNotes)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-drip-elevated text-txt-muted rounded-full text-xs border border-glass-border hover:border-glass-hover transition-colors"
              >
                <span>📝</span>
                <span>Yesterday's notes</span>
                <span className="text-txt-dim">{showYesterdayNotes ? '▼' : '▶'}</span>
              </button>
              {showYesterdayNotes && (
                <div className="mt-2 p-3 bg-drip-elevated border border-glass-border rounded-xl text-sm text-txt-secondary whitespace-pre-wrap">
                  {yesterdayRitual.notes}
                </div>
              )}
            </div>
          )}

          {isEditing && (
            <input
              type="text"
              value={newIntention}
              onChange={(e) => setNewIntention(e.target.value)}
              onKeyDown={handleKeyPress}
              onBlur={() => {
                if (!newIntention.trim()) {
                  setIsEditing(false);
                }
              }}
              placeholder="What will you focus on today?"
              className="w-full px-3 py-1.5 bg-glass-bg border border-glass-border rounded-xl text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:ring-2 focus:ring-focus/30"
              autoFocus
            />
          )}
        </div>

        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs px-2 py-1 text-focus hover:bg-focus/10 rounded-lg transition-colors flex-shrink-0"
          >
            + Add
          </button>
        )}
      </div>
    </div>
  );
}

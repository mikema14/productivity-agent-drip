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

  // Calculate yesterday's date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = yesterday.toISOString().split('T')[0];

  // Load yesterday's ritual on mount
  useEffect(() => {
    loadRitual(yesterdayDate);
  }, [yesterdayDate, loadRitual]);

  // Get yesterday's ritual from store
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
    // Collapsed state when no intentions
    return (
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 italic">No intentions set for today</span>
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Set Intention
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-start gap-2">
        {/* Lightning icon */}
        <span className="text-blue-600 text-lg flex-shrink-0 mt-0.5">⚡</span>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {/* Intentions chips */}
          {intentions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {intentions.map((intention, index) => (
                <div
                  key={index}
                  className="group inline-flex items-center gap-1.5 px-3 py-1 bg-white text-blue-900 rounded-full text-sm border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  <span>{intention}</span>
                  <button
                    onClick={() => handleRemove(index)}
                    className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-800 transition-opacity text-xs"
                    aria-label="Remove intention"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Yesterday's notes section */}
          {yesterdayRitual?.notes && (
            <div className="mb-2">
              <button
                onClick={() => setShowYesterdayNotes(!showYesterdayNotes)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs border border-gray-300 hover:bg-gray-200 transition-colors"
              >
                <span>📝</span>
                <span>Yesterday's notes</span>
                <span className="text-gray-500">{showYesterdayNotes ? '▼' : '▶'}</span>
              </button>
              {showYesterdayNotes && (
                <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                  {yesterdayRitual.notes}
                </div>
              )}
            </div>
          )}

          {/* Input (shown when editing) */}
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
              className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          )}
        </div>

        {/* Edit/Add button */}
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-100 rounded transition-colors flex-shrink-0"
          >
            + Add
          </button>
        )}
      </div>
    </div>
  );
}

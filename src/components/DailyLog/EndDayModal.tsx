import { useState, useEffect } from 'react';
import { useLogStore } from '../../stores/logStore';
import { useTaskPreferencesStore } from '../../stores/taskPreferencesStore';
import { useIntentionsStore } from '../../stores/intentionsStore';
import { useShutdownStore } from '../../stores/shutdownStore';

interface EndDayModalProps {
  date: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EndDayModal({ date, onClose, onSuccess }: EndDayModalProps) {
  const logStore = useLogStore();
  const { preferences } = useTaskPreferencesStore();
  const { getIntentions, addIntention } = useIntentionsStore();
  const { saveRitual } = useShutdownStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Review data
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [deepWorkMinutes, setDeepWorkMinutes] = useState(0);
  const [tasksWorked, setTasksWorked] = useState<string[]>([]);

  // Today's intentions (loaded from store)
  const todayIntentions = getIntentions(date);

  // User inputs
  const [reflection, setReflection] = useState('');
  const [notes, setNotes] = useState('');
  const [tomorrowIntention1, setTomorrowIntention1] = useState('');
  const [tomorrowIntention2, setTomorrowIntention2] = useState('');
  const [tomorrowIntention3, setTomorrowIntention3] = useState('');

  useEffect(() => {
    loadDayData();
  }, [date]);

  async function loadDayData() {
    setIsLoading(true);
    try {
      // Get tracked task IDs (deep work tasks)
      const trackedTaskIds = Array.from(preferences.values())
        .filter(p => p.tracked)
        .map(p => p.taskId);

      // Fetch total work data for today
      const weeklyTotalData = await logStore.getDashboardWeeklyAllData();

      // Fetch deep work data
      // If no tasks marked as tracked → ALL work = deep work (per spec)
      const weeklyDeepData = trackedTaskIds.length > 0
        ? await logStore.getDashboardWeeklyData(trackedTaskIds)
        : weeklyTotalData; // All work counts as deep work

      // Find today's data (last item in the array)
      const todayTotal = weeklyTotalData[weeklyTotalData.length - 1]?.minutes || 0;
      const todayDeep = weeklyDeepData[weeklyDeepData.length - 1]?.minutes || 0;

      // Get tasks worked on today
      if (window.logAPI) {
        const sessions = await window.logAPI.getSessions(date);
        const adhocEntries = await window.logAPI.getAdhocEntries(date);

        const taskIds = new Set<string>();
        sessions.forEach(s => s.task_id && taskIds.add(s.task_id));
        adhocEntries.forEach(e => e.task_id && taskIds.add(e.task_id));

        setTasksWorked(Array.from(taskIds));
      }

      setTotalMinutes(todayTotal);
      setDeepWorkMinutes(todayDeep);
    } catch (error) {
      console.error('Failed to load day data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  };

  async function handleSubmit() {
    setIsSaving(true);
    try {
      // Collect tomorrow's intentions
      const tomorrowIntentions = [
        tomorrowIntention1,
        tomorrowIntention2,
        tomorrowIntention3
      ].filter(i => i.trim().length > 0);

      // Save shutdown ritual
      await saveRitual(
        date,
        totalMinutes,
        deepWorkMinutes,
        tasksWorked,
        reflection.trim() || null,
        notes.trim() || null,
        tomorrowIntentions.length > 0 ? tomorrowIntentions : null
      );

      // Auto-populate tomorrow's intentions
      if (tomorrowIntentions.length > 0) {
        const tomorrow = new Date(date);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowDate = tomorrow.toISOString().split('T')[0];

        for (const intention of tomorrowIntentions) {
          await addIntention(tomorrowDate, intention);
        }
      }

      onSuccess();
    } catch (error) {
      console.error('Failed to end day:', error);
      alert('Failed to save shutdown ritual. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="text-gray-500">Loading day summary...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">End Day - {date}</h2>
          <p className="text-sm text-gray-600 mt-1">Review your day and set intentions for tomorrow</p>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Section 1: Today's Intentions */}
          {todayIntentions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span>⚡</span>
                <span>Today's Plan</span>
              </h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-2">What you set out to do today:</div>
                <div className="space-y-2">
                  {todayIntentions.map((intention, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span className="text-gray-900">{intention}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Review */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>📊</span>
              <span>Review</span>
            </h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Total Work</div>
                  <div className="text-2xl font-bold text-gray-900">{formatHours(totalMinutes)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Deep Work</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatHours(deepWorkMinutes)}
                    {totalMinutes > 0 && (
                      <span className="text-sm font-normal text-gray-600 ml-2">
                        ({Math.round((deepWorkMinutes / totalMinutes) * 100)}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {tasksWorked.length > 0 && (
                <div>
                  <div className="text-sm text-gray-600 mb-1">Tasks Worked On:</div>
                  <div className="flex flex-wrap gap-2">
                    {tasksWorked.map(taskId => (
                      <span key={taskId} className="px-2 py-1 bg-white border border-blue-300 rounded text-sm font-mono">
                        #{taskId}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Reflection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>💭</span>
              <span>Reflection</span>
              <span className="text-sm font-normal text-gray-500">(optional)</span>
            </h3>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="What moved forward today? What did you learn?"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          {/* Section 3: Daily Notes */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>📝</span>
              <span>Daily Notes</span>
              <span className="text-sm font-normal text-gray-500">(optional)</span>
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Blockers, links, reminders for tomorrow..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          {/* Section 4: Tomorrow */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>✨</span>
              <span>Tomorrow's Intentions</span>
              <span className="text-sm font-normal text-gray-500">(1-3 items)</span>
            </h3>
            <div className="space-y-2">
              <input
                type="text"
                value={tomorrowIntention1}
                onChange={(e) => setTomorrowIntention1(e.target.value)}
                placeholder="First intention..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                value={tomorrowIntention2}
                onChange={(e) => setTomorrowIntention2(e.target.value)}
                placeholder="Second intention (optional)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                value={tomorrowIntention3}
                onChange={(e) => setTomorrowIntention3(e.target.value)}
                placeholder="Third intention (optional)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'End Day'}
          </button>
        </div>
      </div>
    </div>
  );
}

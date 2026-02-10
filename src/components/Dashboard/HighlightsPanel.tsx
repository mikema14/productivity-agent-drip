import { useState, useEffect } from 'react';
import { useLogStore } from '../../stores/logStore';
import { useMilestonesStore } from '../../stores/milestonesStore';
import { useTaskPreferencesStore } from '../../stores/taskPreferencesStore';

interface Highlight {
  icon: string;
  text: string;
}

export default function HighlightsPanel() {
  const logStore = useLogStore();
  const { milestones } = useMilestonesStore();
  const { preferences } = useTaskPreferencesStore();
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  useEffect(() => {
    async function calculateHighlights() {
      // Get tracked task IDs
      const trackedTaskIds = Array.from(preferences.values())
        .filter(p => p.tracked)
        .map(p => p.taskId);

      const newHighlights: Highlight[] = [];

      // Get dashboard data
      const dashboardData = await logStore.getDashboardHighlights(trackedTaskIds);

      // Fetch total work for this week (for deep work percentage calculation)
      const weeklyTotalData = await logStore.getDashboardWeeklyAllData();

      // Fetch deep work data
      // If no tasks marked as tracked → ALL work = deep work (per spec)
      const weeklyDeepData = trackedTaskIds.length > 0
        ? await logStore.getDashboardWeeklyData(trackedTaskIds)
        : weeklyTotalData; // All work counts as deep work

      const totalWeekMinutes = weeklyTotalData.reduce((sum, day) => sum + day.minutes, 0);
      const deepWeekMinutes = weeklyDeepData.reduce((sum, day) => sum + day.minutes, 0);

      // Deep Work metric (priority 1)
      if (totalWeekMinutes > 0) {
        const deepWorkPercent = Math.round((deepWeekMinutes / totalWeekMinutes) * 100);
        newHighlights.push({
          icon: '🎯',
          text: `Deep Work: ${deepWeekMinutes} min (${deepWorkPercent}% of total)`
        });
      }

      // Best day in last 90 days
      if (dashboardData.bestDay.minutes > 0) {
        const dayName = new Date(dashboardData.bestDay.date).toLocaleDateString('en-US', { weekday: 'long' });
        newHighlights.push({
          icon: '🏆',
          text: `Best day: ${dayName} (${dashboardData.bestDay.minutes} min)`
        });
      }

      // Current streak (consecutive days with >= 25 minutes)
      if (dashboardData.currentStreak > 0) {
        newHighlights.push({
          icon: '🔥',
          text: `Current streak: ${dashboardData.currentStreak} day${dashboardData.currentStreak === 1 ? '' : 's'}`
        });
      }

      // Weekly total (renamed from "Weekly trend")
      if (totalWeekMinutes > 0) {
        newHighlights.push({
          icon: '📊',
          text: `Total this week: ${totalWeekMinutes} min`
        });
      }

      // Milestones completed
      const completedCount = Array.from(milestones.values()).filter(m => m.completed).length;

      if (completedCount > 0) {
        newHighlights.push({
          icon: '✔',
          text: `Completed ${completedCount} milestone${completedCount === 1 ? '' : 's'}`
        });
      }

      setHighlights(newHighlights);
    }
    calculateHighlights();
  }, [logStore, milestones, preferences]);

  // Map icons to better emojis
  const getIcon = (iconFromData: string, text: string): string => {
    // Use icon from data if already an emoji, otherwise map based on text
    if (iconFromData && iconFromData.length > 1) return iconFromData;
    if (text.includes('Deep Work')) return '🎯';
    if (text.includes('Best day')) return '🏆';
    if (text.includes('streak')) return '🔥';
    if (text.includes('Total this week')) return '📊';
    if (text.includes('milestone')) return '✓';
    return '✓';
  };

  return (
    <div className="glass-surface p-6">
      <h2 className="text-lg font-display font-semibold text-txt-primary mb-4">Highlights</h2>

      {highlights.length === 0 ? (
        <p className="text-txt-muted text-sm">No highlights yet. Start tracking time!</p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {highlights.map((highlight, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-glass-bg rounded-xl border border-glass-border"
            >
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-drip-surface rounded-full text-xl">
                {getIcon(highlight.icon, highlight.text)}
              </div>
              <span className="text-txt-primary text-sm font-medium">{highlight.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

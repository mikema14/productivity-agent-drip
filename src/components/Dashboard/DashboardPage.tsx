import { useEffect } from 'react';
import { useGoalsStore } from '../../stores/goalsStore';
import { useIntentionsStore } from '../../stores/intentionsStore';
import { useTaskPreferencesStore } from '../../stores/taskPreferencesStore';
import { useMilestonesStore } from '../../stores/milestonesStore';
import IdentityHeader from './IdentityHeader';
import TodayIntentionsPanel from './TodayIntentionsPanel';
import TrackedTasksPanel from './TrackedTasksPanel';
import WeeklyChart from './WeeklyChart';
import Heatmap90Days from './Heatmap90Days';
import HighlightsPanel from './HighlightsPanel';

interface DashboardPageProps {
  onNavigateToTask?: (taskId: string) => void;
}

export default function DashboardPage({ onNavigateToTask }: DashboardPageProps) {
  const { loadAll: loadGoals } = useGoalsStore();
  const { loadAll: loadPreferences } = useTaskPreferencesStore();
  const today = new Date().toISOString().split('T')[0];
  const { loadDay: loadIntentions } = useIntentionsStore();

  useEffect(() => {
    // Load all dashboard data on mount
    loadGoals();
    loadPreferences();
    loadIntentions(today);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column (8 columns) */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        <IdentityHeader />
        <TodayIntentionsPanel />
        <TrackedTasksPanel onNavigateToTask={onNavigateToTask} />
      </div>

      {/* Right Column (4 columns) */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        <HighlightsPanel />
        <WeeklyChart />
        <Heatmap90Days />
      </div>
    </div>
  );
}
